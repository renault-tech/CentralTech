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
