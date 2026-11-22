"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CarFront,
  CheckCheck,
  Droplets,
  ExternalLink,
  Fuel,
  Gauge,
  Globe,
  House,
  KeyRound,
  Landmark,
  LayoutGrid,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { definirBarraRecolhida } from "@/lib/modulo/actions-barra";
import type { ModuloComBarra } from "@/lib/modulo/barra-cookie";
import { cn } from "@/lib/utils";

/** Ícones disponíveis para a barra, por nome (o servidor não pode mandar componentes para o cliente, só o nome). */
const ICONES: Record<string, LucideIcon> = {
  painel: LayoutGrid,
  emendas: Landmark,
  pendencias: TriangleAlert,
  conformidade: ShieldCheck,
  panorama: Gauge,
  aprovacoes: CheckCheck,
  relatorios: BarChart3,
  portal: Globe,
  vereadores: Users,
  secretarias: Building2,
  configuracoes: Settings,
  combustivel: Fuel,
  manutencao: Wrench,
  veiculos: CarFront,
  custos: TrendingUp,
  analise: BarChart3,
  imoveis: House,
  agua: Droplets,
  luz: Zap,
  entregas: PackageCheck,
  vencimentos: CalendarClock,
  chave: KeyRound,
};
export type NomeIcone = keyof typeof ICONES;

export type ItemLateral = { href: string; rotulo: string; icone?: NomeIcone; exato?: boolean; selo?: number; selos?: "alerta" };
export type GrupoLateral = { titulo: string; itens: ItemLateral[] };
export type AtalhoExterno = { href: string; rotulo: string; dica?: string };

/**
 * Barra lateral dos módulos (a partir de `lg`; abaixo disso vale a faixa de abas `NavModulo`). É só navegação: os mesmos itens e
 * rotas da faixa, agrupados. Item ativo = pílula na cor do módulo. Recolhível: o botão do topo (ou a tecla "[") alterna entre a barra
 * com nomes (13 rem) e uma faixa só de ícones (3,75 rem), com a escolha lembrada por navegador e por módulo (cookie). Recolhida, cada
 * ícone tem dica com o nome e o selo vira um ponto. `atalhoExterno` (opcional) é um link tracejado no pé da barra.
 */
export function BarraLateral({
  modulo,
  grupos,
  rotuloAria,
  tour,
  recolhidaInicial = false,
  atalhoExterno,
}: {
  modulo: ModuloComBarra;
  grupos: GrupoLateral[];
  rotuloAria: string;
  tour?: string;
  recolhidaInicial?: boolean;
  atalhoExterno?: AtalhoExterno;
}) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = React.useState(recolhidaInicial);
  const [, iniciar] = React.useTransition();

  const alternar = React.useCallback(() => {
    const nova = !recolhida;
    setRecolhida(nova);
    iniciar(() => {
      void definirBarraRecolhida(modulo, nova);
    });
  }, [recolhida, modulo]);

  React.useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null;
      if (ev.key !== "[" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      alternar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [alternar]);

  return (
    <aside className={cn("emd-lateral hidden shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:block print:hidden", recolhida ? "w-[3.75rem]" : "w-52")}>
      <nav
        aria-label={rotuloAria}
        data-tour={tour}
        className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-2.5 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-2"
      >
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          aria-label={recolhida ? "Expandir a barra lateral" : "Recolher a barra lateral"}
          title={recolhida ? "Expandir menu ( [ )" : "Recolher menu ( [ )"}
          className={cn("flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-cataguases-marinho focus-visible:ring-2 focus-visible:ring-[color:var(--modulo-tinta)]", recolhida && "justify-center px-0")}
        >
          {recolhida ? <PanelLeftOpen className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <PanelLeftClose className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
          {!recolhida && <span>Recolher menu</span>}
        </button>
        {grupos.map((g) => {
          if (g.itens.length === 0) return null;
          return (
            <div key={g.titulo} className="border-t border-slate-200/70 pt-2">
              {!recolhida && <p className="px-2.5 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{g.titulo}</p>}
              <ul className="flex flex-col gap-0.5">
                {g.itens.map((item) => {
                  const Icone = (item.icone && ICONES[item.icone]) || LayoutGrid;
                  const ativo = item.exato ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={ativo ? "page" : undefined}
                        aria-label={recolhida ? `${item.rotulo}${item.selo ? `, ${item.selo} pendente(s)` : ""}` : undefined}
                        title={recolhida ? item.rotulo : undefined}
                        className={cn(
                          "relative flex min-h-10 items-center gap-2.5 rounded-xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--modulo-tinta)]",
                          recolhida ? "justify-center px-0" : "px-2.5",
                          ativo ? "font-semibold" : "font-medium text-slate-700 hover:bg-slate-100 hover:text-cataguases-marinho"
                        )}
                      >
                        <Icone className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden />
                        {!recolhida && <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>}
                        {!!item.selo &&
                          (recolhida ? (
                            <span className={cn("absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-white", item.selos === "alerta" ? "bg-red-600" : "bg-[color:var(--modulo-texto)]")} aria-hidden />
                          ) : (
                            <span className={cn("rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-white", item.selos === "alerta" ? "bg-red-600" : "bg-[color:var(--modulo-texto)]")}>
                              {item.selo}
                              <span className="sr-only"> pendente(s)</span>
                            </span>
                          ))}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {atalhoExterno && (
          <a
            href={atalhoExterno.href}
            target="_blank"
            rel="noopener"
            title={recolhida ? (atalhoExterno.dica ?? atalhoExterno.rotulo) : undefined}
            aria-label={recolhida ? `${atalhoExterno.dica ?? atalhoExterno.rotulo} (abre em outra aba)` : undefined}
            className={cn("mt-0.5 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 py-2 text-xs text-slate-600 transition-colors duration-200 hover:border-[color:var(--modulo)] hover:text-[color:var(--modulo-tinta)]", recolhida ? "justify-center px-0" : "mx-0.5 px-2.5")}
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {!recolhida && (
              <>
                {atalhoExterno.rotulo}
                <span className="sr-only">(abre em outra aba)</span>
              </>
            )}
          </a>
        )}
      </nav>
    </aside>
  );
}
