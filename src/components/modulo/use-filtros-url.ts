"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Filtros de uma lista que vivem na URL, mas cuja verdade na tela é um estado local: o clique responde no mesmo
 * quadro (sem esperar o roteador do Next reemitir `useSearchParams` dentro de uma transição, que era o que fazia o
 * gráfico "agarrar"); a URL só espelha o estado, com `replaceState`, para o link poder ser compartilhado.
 *
 * Também lembra os filtros da lista (por aba do navegador, em `sessionStorage`): quem abre uma emenda e volta —
 * pelo "Voltar" da página ou pela aba "Emendas" do menu, que chegam sem filtro na URL — encontra a lista como a deixou.
 * O que vale é guardado junto do `contexto` (o exercício): filtros de 2026 não se aplicam a 2027.
 */
const PREFIXO = "filtros-lista:";

function lerSalvo(chave: string): { contexto: string; q: string } | null {
  try {
    const bruto = window.sessionStorage.getItem(PREFIXO + chave);
    return bruto ? (JSON.parse(bruto) as { contexto: string; q: string }) : null;
  } catch {
    return null;
  }
}

function gravarSalvo(chave: string, contexto: string, q: string) {
  try {
    if (q) window.sessionStorage.setItem(PREFIXO + chave, JSON.stringify({ contexto, q }));
    else window.sessionStorage.removeItem(PREFIXO + chave);
  } catch {
    // navegação privada ou armazenamento bloqueado: a lista só deixa de lembrar
  }
}

/** Texto da consulta sem o `ano` (o exercício vai ao servidor por outro caminho). */
function semAno(texto: string) {
  const p = new URLSearchParams(texto);
  p.delete("ano");
  return p.toString();
}

export function useFiltrosUrl(chave: string, contexto: string) {
  const pathname = usePathname();
  const doRoteador = useSearchParams().toString();
  const [texto, setTexto] = React.useState(doRoteador);
  const atual = React.useRef(doRoteador);
  /** Consultas que EU escrevi na URL: o roteador as devolve com atraso e elas não devem desfazer um clique mais novo. */
  const escritas = React.useRef(new Set<string>());
  const pausa = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const gravarNaUrl = React.useCallback(
    (consulta: string) => {
      escritas.current.add(consulta);
      window.history.replaceState(null, "", consulta ? `${pathname}?${consulta}` : pathname);
    },
    [pathname]
  );

  const aplicar = React.useCallback(
    (consulta: string, adiarUrl: boolean) => {
      atual.current = consulta;
      setTexto(consulta);
      if (pausa.current) clearTimeout(pausa.current);
      if (adiarUrl) pausa.current = setTimeout(() => gravarNaUrl(atual.current), 250);
      else gravarNaUrl(consulta);
    },
    [gravarNaUrl]
  );

  /** `adiarUrl`: para o campo de busca, que muda a cada tecla — a tela responde já, a URL espera a pausa. */
  const definir = React.useCallback(
    (mudancas: Record<string, string | undefined>, adiarUrl = false) => {
      const p = new URLSearchParams(atual.current);
      for (const [k, v] of Object.entries(mudancas)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      aplicar(p.toString(), adiarUrl);
    },
    [aplicar]
  );

  // Navegação de fora (link do Painel, "voltar" do navegador): o roteador manda uma consulta que não foi eu que escrevi.
  React.useEffect(() => {
    if (doRoteador === atual.current) {
      escritas.current.clear();
      return;
    }
    if (escritas.current.has(doRoteador)) return;
    atual.current = doRoteador;
    setTexto(doRoteador);
  }, [doRoteador]);

  // Chegou sem filtro nenhum (só, no máximo, o exercício): reaplica os da última visita a esta lista.
  React.useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (semAno(url.toString())) return;
    const salvo = lerSalvo(chave);
    if (!salvo || salvo.contexto !== contexto || !salvo.q) return;
    const p = new URLSearchParams(salvo.q);
    if (url.get("ano")) p.set("ano", url.get("ano") as string);
    // sincroniza com o armazenamento do navegador (sistema externo), só na chegada à tela
    // eslint-disable-next-line react-hooks/set-state-in-effect
    aplicar(p.toString(), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    gravarSalvo(chave, contexto, semAno(texto));
  }, [chave, contexto, texto]);

  React.useEffect(
    () => () => {
      if (pausa.current) clearTimeout(pausa.current);
    },
    []
  );

  const params = React.useMemo(() => new URLSearchParams(texto), [texto]);
  return { params, definir };
}
