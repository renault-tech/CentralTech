"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = { href: string; rotulo: string; exato?: boolean; selo?: number };

/** Faixa de navegação do módulo Frotas (abaixo do cabeçalho da Central). Casa por prefixo, com a cor do módulo no sublinhado. */
export function NavModulo({ itens }: { itens: Item[] }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Seções do módulo Frotas" data-tour="nav-frotas">
          {itens.map((item) => {
            const ativo = item.exato ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap border-b-[3px] px-3.5 py-3.5 text-sm transition-colors",
                  ativo ? "border-[#5C7A1F] font-semibold text-cataguases-marinho" : "border-transparent text-slate-600 hover:text-cataguases-marinho"
                )}
              >
                {item.rotulo}
                {!!item.selo && <span className="ml-1.5 rounded-full bg-[#3F5A12] px-1.5 py-px text-[11px] font-medium tabular-nums text-white">{item.selo}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
