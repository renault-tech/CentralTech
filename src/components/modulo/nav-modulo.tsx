"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ItemNav = {
  href: string;
  rotulo: string;
  /** Só fica ativo na rota exata (o Painel, que é prefixo de todas as outras). */
  exato?: boolean;
  selo?: number;
  /** Abre em outra aba, fora do módulo (ex.: portal público). */
  externo?: boolean;
};

/**
 * Faixa de navegação do módulo (abaixo do cabeçalho da Central) — a MESMA em todos os módulos.
 * Casa por prefixo (abrir uma emenda acende "Emendas"); o sublinhado e o selo usam a cor do módulo
 * (`--modulo` / `--modulo-texto`, definidas no layout). `acao` é o botão principal à direita
 * (ex.: "Nova emenda"). Alvos de toque de 44 px no celular.
 */
export function NavModulo({ itens, rotuloAria, tour, acao }: { itens: ItemNav[]; rotuloAria: string; tour?: string; acao?: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 sm:px-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label={rotuloAria} data-tour={tour}>
          {itens.map((item) => {
            if (item.externo) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-[3px] border-transparent px-3.5 text-sm text-slate-600 transition-colors duration-200 hover:text-cataguases-marinho"
                >
                  {item.rotulo}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">(abre em outra aba)</span>
                </a>
              );
            }
            const ativo = item.exato ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-[3px] px-3.5 text-sm transition-colors duration-200",
                  ativo
                    ? "border-[color:var(--modulo)] font-semibold text-cataguases-marinho"
                    : "border-transparent text-slate-600 hover:text-cataguases-marinho"
                )}
              >
                {item.rotulo}
                {!!item.selo && (
                  <span className="ml-1.5 rounded-full bg-[color:var(--modulo-texto)] px-1.5 py-px text-[11px] font-medium tabular-nums text-white">
                    {item.selo}
                    <span className="sr-only"> pendente(s)</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        {acao && <div className="my-1.5 print:hidden">{acao}</div>}
      </div>
    </div>
  );
}
