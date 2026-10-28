"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type Item = { href: string; rotulo: string; exato?: boolean; selo?: number; /** Abre em outra aba (fora do módulo, ex.: portal público). */ externo?: boolean };

/** Faixa de navegação do módulo (abaixo do cabeçalho da Central). Igual à
 * `AbasNavegacao`, mas casando por prefixo (o detalhe de uma emenda acende
 * "Emendas") e com a cor do módulo no sublinhado. */
export function NavModulo({ itens, podeCriar }: { itens: Item[]; podeCriar: boolean }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Seções do módulo Emendas" data-tour="nav-emendas">
          {itens.map((item) => {
            if (item.externo) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 text-sm text-slate-600 transition-colors hover:text-cataguases-marinho"
                >
                  {item.rotulo}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
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
                  "shrink-0 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm transition-colors",
                  ativo
                    ? "border-[#6B4FBB] font-semibold text-cataguases-marinho"
                    : "border-transparent text-slate-600 hover:text-cataguases-marinho"
                )}
              >
                {item.rotulo}
                {!!item.selo && <span className="ml-1.5 rounded-full bg-[#6B4FBB] px-1.5 py-px text-[11px] font-medium tabular-nums text-white">{item.selo}</span>}
              </Link>
            );
          })}
        </nav>
        {podeCriar && (
          <Link
            href="/emendas/nova"
            className="my-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#5B3FA8]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova emenda
          </Link>
        )}
      </div>
    </div>
  );
}
