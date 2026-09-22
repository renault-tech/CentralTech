"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Forma mínima que toda `Resultado*` deste projeto já segue (discriminated
 * union `{ sucesso: true; aviso?: string } | { sucesso: false; erro: string }`).
 * Usar essa forma permissiva (em vez do union exato como constraint) evita
 * depender de estreitamento de union sobre parâmetro genérico, que o
 * TypeScript não faz de forma confiável.
 */
type ResultadoAcao = { sucesso: boolean; erro?: string; aviso?: string };

/**
 * Estado + execução de uma server action que devolve `Resultado*`
 * (`{ sucesso, erro? }`, com `aviso?` opcional) — pendente/erro/aviso e
 * `router.refresh()` no sucesso. Eram 6 cópias idênticas espalhadas por
 * `acoes-ciclo.tsx`, `editar-processo.tsx`, `gerenciador-usuarios.tsx`,
 * `gerenciador-modalidades.tsx`, `gerenciador-secretarias.tsx` e
 * `editor-fluxos.tsx` (achado da auditoria de UI/UX); esta é a única versão.
 */
export function useAcao<T extends ResultadoAcao>() {
  const router = useRouter();
  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  async function executar(acao: () => Promise<T>, aoConcluir?: () => void) {
    setPendente(true);
    setErro(null);
    setAviso(null);
    const resultado = await acao();
    setPendente(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro ?? "Não foi possível concluir a ação. Tente novamente.");
      return;
    }
    if (resultado.aviso) {
      setAviso(resultado.aviso);
    }
    aoConcluir?.();
    router.refresh();
  }

  return { pendente, erro, setErro, aviso, executar };
}
