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
 * Casa por prefixo (abrir uma emenda acende "Emendas"). A aba ativa é uma pílula na cor do módulo (fundo suave,
 * texto `--modulo-tinta` e barra de 3 px em `--modulo`), as demais têm texto escuro e realce ao passar o mouse;
 * o selo usa `--modulo-texto` (definidas no layout). `acao` é o botão principal à direita (ex.: "Nova emenda").
 * Alvos de toque de 44 px no celular.
 */
export function NavModulo({
  itens,
  rotuloAria,
  tour,
  acao,
  ocultarAcaoEm,
}: {
  itens: ItemNav[];
  rotuloAria: string;
  tour?: string;
  acao?: ReactNode;
  /** Prefixo de rota onde a ação sai da faixa (a própria tela a mostra junto do título). */
  ocultarAcaoEm?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-300 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 px-3 py-1.5 sm:px-5">
        <nav className="flex flex-wrap gap-1" aria-label={rotuloAria} data-tour={tour}>
          {itens.map((item) => {
            if (item.externo) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-100 hover:text-cataguases-marinho sm:min-h-10"
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
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors duration-200 sm:min-h-10",
                  ativo
                    ? "bg-[color-mix(in_srgb,var(--modulo)_13%,transparent)] font-semibold text-[color:var(--modulo-tinta)] shadow-[inset_0_-3px_0_0_var(--modulo)]"
                    : "font-medium text-slate-700 hover:bg-slate-100 hover:text-cataguases-marinho"
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
        {acao && !(ocultarAcaoEm && pathname.startsWith(ocultarAcaoEm)) && <div className="print:hidden">{acao}</div>}
      </div>
    </div>
  );
}
