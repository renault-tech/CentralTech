"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Linha de tabela inteira clicável: clicar em qualquer ponto dela abre `href` (Ctrl/Cmd ou botão do meio abre em outra aba).
 * Links, botões e campos dentro da linha seguem funcionando por conta própria, e selecionar texto não navega.
 * Teclado e leitor de tela continuam usando o link que a própria linha já tem (título/número): a linha não ganha papel de link.
 */
export function LinhaLink({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const router = useRouter();
  const deInteracao = (alvo: EventTarget) => !!(alvo as HTMLElement).closest?.("a,button,input,select,textarea,label,summary,[role='button']");
  return (
    <tr
      style={style}
      className={cn("emd-linha-clic group cursor-pointer", className)}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(e) => {
        if (e.defaultPrevented || deInteracao(e.target) || window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
      onAuxClick={(e) => {
        if (e.button === 1 && !deInteracao(e.target)) window.open(href, "_blank", "noopener");
      }}
    >
      {children}
    </tr>
  );
}
