"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { montarUrlComParametros } from "@/lib/filtros-url";

/**
 * Formulário de filtros que vale NA HORA, sem botão "Filtrar" (regra da plataforma): lista suspensa, caixa de
 * marcação e botão de opção aplicam ao escolher; campo de texto aplica depois de uma pausa na digitação
 * (ou no Enter). A página continua sendo de servidor: a URL muda com `router.replace` dentro de uma transição,
 * então a lista anterior fica visível enquanto a nova carrega e o campo de busca não perde o foco.
 *
 * Os campos são não controlados (`defaultValue`) e levam `name`, como num `<form method="get">`; campos
 * `hidden` do formulário seguem na URL. Sem JavaScript o formulário ainda funciona pelo Enter (GET normal).
 */
const PAUSA_DIGITACAO_MS = 350;

/** Mesma memória das listas filtradas no navegador (`useFiltrosUrl`): quem volta de um detalhe encontra o recorte que deixou. */
const CHAVE_SALVA = (caminho: string) => `filtros-lista:${caminho}`;
function lerSalvo(caminho: string): string {
  try {
    return window.sessionStorage.getItem(CHAVE_SALVA(caminho)) ?? "";
  } catch {
    return "";
  }
}
function gravarSalvo(caminho: string, consulta: string) {
  try {
    if (consulta) window.sessionStorage.setItem(CHAVE_SALVA(caminho), consulta);
    else window.sessionStorage.removeItem(CHAVE_SALVA(caminho));
  } catch {
    // armazenamento bloqueado: só deixa de lembrar
  }
}

export function FormularioFiltros({
  children,
  className,
  limpar,
}: {
  children: ReactNode;
  className?: string;
  /** Botão "Limpar": zera os campos e volta para `href` (sem filtros). */
  limpar?: { href: string; className?: string; visivel?: boolean };
}) {
  const router = useRouter();
  const caminho = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [carregando, iniciar] = useTransition();
  const [composicao, setComposicao] = useState(false);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  // Chegou sem filtro nenhum (aba do menu, "Voltar"): reaplica os da última visita, já mostrando nos campos.
  useEffect(() => {
    const atual = new URLSearchParams(window.location.search);
    const ano = atual.get("ano");
    atual.delete("ano");
    if (atual.toString()) return; // chegou com filtros próprios (link de outra tela)
    const form = formRef.current;
    const salvoBruto = lerSalvo(caminho);
    if (!salvoBruto || !form) return;
    const p = new URLSearchParams(salvoBruto);
    if (ano) p.set("ano", ano);
    const salvo = p.toString();
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement && el.name && el.type !== "hidden") {
        if (el.type === "checkbox" || el.type === "radio") el.checked = p.get(el.name) === el.value;
        else el.value = p.get(el.name) ?? "";
      } else if (el instanceof HTMLSelectElement && el.name) el.value = p.get(el.name) ?? "";
    }
    iniciar(() => router.replace(`${caminho}?${salvo}`, { scroll: false }));
    // só na chegada à tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    const form = formRef.current;
    if (!form) return;
    const params: Record<string, string> = {};
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string") params[k] = v;
    });
    const url = montarUrlComParametros(caminho, params);
    gravarSalvo(caminho, url.includes("?") ? url.split("?")[1] : "");
    iniciar(() => router.replace(url, { scroll: false }));
  }

  function aoMudar(e: React.FormEvent<HTMLFormElement>) {
    const alvo = e.target as HTMLInputElement;
    const digitando = alvo.tagName === "TEXTAREA" || (alvo.tagName === "INPUT" && ["text", "search", "number"].includes(alvo.type));
    if (!digitando) return aplicar();
    if (composicao) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(aplicar, PAUSA_DIGITACAO_MS);
  }

  function limparCampos() {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement) {
        if (el.type === "hidden") continue;
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      } else if (el instanceof HTMLSelectElement) el.value = "";
    }
    if (temporizador.current) clearTimeout(temporizador.current);
    gravarSalvo(caminho, "");
    iniciar(() => router.replace(limpar!.href, { scroll: false }));
  }

  return (
    <form
      ref={formRef}
      method="get"
      className={className}
      aria-busy={carregando}
      onChange={aoMudar}
      onCompositionStart={() => setComposicao(true)}
      onCompositionEnd={() => {
        setComposicao(false);
        if (temporizador.current) clearTimeout(temporizador.current);
        temporizador.current = setTimeout(aplicar, PAUSA_DIGITACAO_MS);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        aplicar();
      }}
    >
      {children}
      {limpar && limpar.visivel !== false && (
        <button type="button" onClick={limparCampos} className={limpar.className}>
          Limpar
        </button>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {carregando ? "Atualizando a lista…" : ""}
      </span>
    </form>
  );
}
