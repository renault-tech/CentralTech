"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Aba = { href: string; rotulo: string };

/** Faixa de abas para áreas com mais de uma sub-rota sob o mesmo cabeçalho
 * (por ora só Configurações) — mesmo componente já usado no App-Compras
 * (Configurações e Relatórios), portado aqui sem alteração. */
export function AbasNavegacao({ abas, label }: { abas: Aba[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label={label}>
      {abas.map((aba) => {
        const ativa = pathname === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              ativa
                ? "border-cataguases-azul font-medium text-cataguases-marinho"
                : "border-transparent text-slate-500 hover:text-cataguases-marinho"
            )}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
