"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

/** Telas sem sessão ou públicas: não há o que atualizar. */
const SEM_ATUALIZAR = ["/login", "/solicitar-acesso", "/recuperar-senha", "/redefinir-senha", "/primeiro-acesso", "/auth", "/transparencia"];

const INTERVALO_MS = 30_000;
const VOLTA_MS = 15_000;

/**
 * Mantém as telas em dia sem recarregar a página: refaz a leitura do servidor a cada 30 s
 * (só com a aba visível), ao voltar para a aba e quando chega um aviso novo. Não interrompe
 * quem está digitando nem uma janela aberta, e não mexe no que está na tela (filtros, abas e
 * campos continuam como estão — é um refresh suave do Next).
 */
export function AtualizarSozinho() {
  const router = useRouter();
  const caminho = usePathname() ?? "/";
  const ativo = !SEM_ATUALIZAR.some((p) => caminho === p || caminho.startsWith(`${p}/`));
  const ultimo = React.useRef(0);

  React.useEffect(() => {
    if (!ativo) return;
    ultimo.current = Date.now();

    const ocupado = () => {
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return true;
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
    };
    const atualizar = (forcar = false) => {
      if (document.hidden || !navigator.onLine) return;
      if (!forcar && ocupado()) return;
      ultimo.current = Date.now();
      router.refresh();
    };

    const relogio = setInterval(() => atualizar(), INTERVALO_MS);
    const aoVoltar = () => {
      if (!document.hidden && Date.now() - ultimo.current > VOLTA_MS) atualizar();
    };
    const aoAviso = () => atualizar(true);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("aviso-novo", aoAviso);
    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener("aviso-novo", aoAviso);
    };
  }, [ativo, router]);

  return null;
}
