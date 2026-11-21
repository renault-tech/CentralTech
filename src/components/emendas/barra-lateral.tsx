"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CheckCheck,
  ExternalLink,
  Gauge,
  Globe,
  Landmark,
  LayoutGrid,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ItemLateral = { href: string; rotulo: string; exato?: boolean; selo?: number; selos?: "alerta" };

const ICONES: Record<string, LucideIcon> = {
  "/emendas": LayoutGrid,
  "/emendas/lista": Landmark,
  "/emendas/pendencias": TriangleAlert,
  "/emendas/conformidade": ShieldCheck,
  "/emendas/panorama": Gauge,
  "/emendas/aprovacoes": CheckCheck,
  "/emendas/relatorios": BarChart3,
  "/emendas/portal": Globe,
  "/emendas/vereadores": Users,
  "/emendas/secretarias": Building2,
  "/emendas/configuracoes": Settings,
};

/** Grupos da barra: o que se acompanha, o que se decide e os cadastros. A ordem dos itens é a de sempre. */
const GRUPOS: { titulo: string; hrefs: string[] }[] = [
  { titulo: "Acompanhamento", hrefs: ["/emendas", "/emendas/lista", "/emendas/pendencias", "/emendas/conformidade", "/emendas/panorama"] },
  { titulo: "Gestão", hrefs: ["/emendas/aprovacoes", "/emendas/relatorios", "/emendas/portal"] },
  { titulo: "Cadastros", hrefs: ["/emendas/vereadores", "/emendas/secretarias", "/emendas/configuracoes"] },
];

/**
 * Barra lateral do módulo Emendas (a partir de `lg`; abaixo disso vale a faixa de abas de sempre).
 * É só navegação: os mesmos itens e rotas da faixa antiga, agrupados. Item ativo = pílula na cor do módulo.
 */
export function BarraLateral({ itens, rotuloAria, tour }: { itens: ItemLateral[]; rotuloAria: string; tour?: string }) {
  const pathname = usePathname();
  const porHref = new Map(itens.map((i) => [i.href, i]));
  return (
    <aside className="emd-lateral hidden w-60 shrink-0 lg:block print:hidden">
      <nav
        aria-label={rotuloAria}
        data-tour={tour}
        className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2.5"
      >
        {GRUPOS.map((g) => {
          const doGrupo = g.hrefs.map((h) => porHref.get(h)).filter(Boolean) as ItemLateral[];
          if (doGrupo.length === 0) return null;
          return (
            <div key={g.titulo}>
              <p className="px-2.5 pb-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{g.titulo}</p>
              <ul className="flex flex-col gap-0.5">
                {doGrupo.map((item) => {
                  const Icone = ICONES[item.href] ?? LayoutGrid;
                  const ativo = item.exato ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={ativo ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--modulo-tinta)]",
                          ativo ? "font-semibold" : "font-medium text-slate-700 hover:bg-slate-100 hover:text-cataguases-marinho"
                        )}
                      >
                        <Icone className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                        {!!item.selo && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-white",
                              item.selos === "alerta" ? "bg-red-600" : "bg-[color:var(--modulo-texto)]"
                            )}
                          >
                            {item.selo}
                            <span className="sr-only"> pendente(s)</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <a
          href="/transparencia/emendas?previa=1"
          target="_blank"
          rel="noopener"
          className="mx-1 mt-1 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-2.5 py-2 text-xs text-slate-600 transition-colors duration-200 hover:border-[color:var(--modulo)] hover:text-[color:var(--modulo-tinta)]"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Ver o portal como o público vê
          <span className="sr-only">(abre em outra aba)</span>
        </a>
      </nav>
    </aside>
  );
}
