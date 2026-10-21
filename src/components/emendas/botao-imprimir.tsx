"use client";

import { Printer } from "lucide-react";

/** "Relatório em PDF": a própria página tem estilo de impressão (cabeçalho
 * e navegação somem); o navegador salva como PDF. */
export function BotaoImprimir({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="h-4 w-4" aria-hidden />
      Relatório em PDF
    </button>
  );
}
