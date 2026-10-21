import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CATALOGO_PADRAO, infoEtapa, posicaoNaTrilha, trilha, type CatalogoEtapas } from "@/lib/emendas/regras";
import type { EtapaEmenda, Modalidade, SituacaoEmenda } from "@/types/emendas";

/** Peças visuais do módulo Emendas, sem estado (servem a Server e Client
 * Components). Mesmo vocabulário visual do mockup aprovado. */

export function Cartao({
  titulo,
  apoio,
  children,
  className,
  acao,
}: {
  titulo?: string;
  apoio?: ReactNode;
  children: ReactNode;
  className?: string;
  acao?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-4 sm:p-5", className)}>
      {(titulo || apoio || acao) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {titulo && <h2 className="text-[15px] font-semibold text-cataguases-marinho">{titulo}</h2>}
          {apoio && <span className="text-xs text-slate-500">{apoio}</span>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  rotulo,
  valor,
  apoio,
  barra,
  corBarra,
  corValor = "#0C1D33",
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  /** 0..1 */
  barra: number;
  corBarra: string;
  corValor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</span>
      <span className="text-2xl font-semibold tabular-nums" style={{ color: corValor }}>
        {valor}
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.max(0, Math.min(1, barra)) * 100}%`, backgroundColor: corBarra }}
        />
      </div>
      <span className="text-xs text-slate-500">{apoio}</span>
    </div>
  );
}

/** Mini barra de andamento (um segmento por etapa da trilha). */
export function BarraEtapas({
  modalidade,
  etapa,
  situacao,
  catalogo = CATALOGO_PADRAO,
}: {
  modalidade: Modalidade;
  etapa: EtapaEmenda;
  situacao?: SituacaoEmenda;
  catalogo?: CatalogoEtapas;
}) {
  const t = trilha(modalidade, catalogo);
  const pos = posicaoNaTrilha(modalidade, etapa, catalogo);
  const corEtapa = infoEtapa(etapa, catalogo).cor;
  const cor = situacao === "impedida" ? "#D97706" : situacao === "cancelada" ? "#94A3B8" : corEtapa === "#CBD5E1" ? "#94A3B8" : corEtapa;
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {t.map((k, i) => (
        <span key={k} className="h-2 flex-1 rounded-[2px]" style={{ backgroundColor: i <= pos ? cor : "#E2E8F0" }} />
      ))}
    </div>
  );
}

export function SeloEtapa({
  etapa,
  situacao,
  catalogo = CATALOGO_PADRAO,
}: {
  etapa: EtapaEmenda;
  situacao: SituacaoEmenda;
  catalogo?: CatalogoEtapas;
}) {
  if (situacao === "impedida") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Impedida</span>;
  }
  if (situacao === "cancelada") {
    return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">Cancelada</span>;
  }
  const info = infoEtapa(etapa, catalogo);
  const escuro = info.grupo >= 2;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: info.grupo === 0 ? "#F1F5F9" : escuro ? "#EDE9FE" : "#F5F3FF",
        color: info.grupo === 0 ? "#334155" : "#3B2A7A",
      }}
    >
      {info.nome}
    </span>
  );
}

export function Chip({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "saude" | "azul" | "amarelo" | "violeta" }) {
  const cores = {
    neutro: "bg-slate-100 text-slate-700",
    saude: "bg-green-100 text-green-800",
    azul: "bg-blue-50 text-blue-900",
    amarelo: "bg-amber-100 text-amber-900",
    violeta: "bg-violet-100 text-violet-900",
  } as const;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", cores[tom])}>{children}</span>;
}

export function LinkVoltar({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-cataguases-azul hover:underline print:hidden">
      ← {children}
    </Link>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</p>;
}

/** Linha de etapas do detalhe da emenda (stepper). */
export function LinhaEtapas({
  modalidade,
  etapa,
  situacao,
  rotulos,
  catalogo = CATALOGO_PADRAO,
}: {
  modalidade: Modalidade;
  etapa: EtapaEmenda;
  situacao: SituacaoEmenda;
  /** Texto de apoio por etapa (data, nº do empenho…). */
  rotulos: Partial<Record<EtapaEmenda, string>>;
  catalogo?: CatalogoEtapas;
}) {
  const t = trilha(modalidade, catalogo);
  const pos = posicaoNaTrilha(modalidade, etapa, catalogo);
  const travada = situacao === "impedida";
  return (
    <ol aria-label="Etapas da emenda" className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-y-3" data-tour="etapas-emenda">
      {t.map((k, i) => {
        const feito = i <= pos;
        const atual = i === pos;
        const proxima = i === pos + 1;
        return (
          <li key={k} className="flex flex-col gap-2 pr-2" aria-current={atual ? "step" : undefined}>
            <div className="flex items-center">
              <span
                className={cn(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-xs font-semibold",
                  feito
                    ? atual
                      ? "border-[#6B4FBB] bg-[#6B4FBB] text-white"
                      : "border-[#563A9E] bg-[#563A9E] text-white"
                    : proxima
                      ? travada
                        ? "border-amber-500 bg-white text-amber-700"
                        : "border-[#6B4FBB] bg-white text-[#6B4FBB]"
                      : "border-slate-300 bg-white text-slate-400"
                )}
              >
                {feito ? "✓" : i + 1}
              </span>
              {i < t.length - 1 && <span className={cn("ml-1.5 h-[3px] flex-1 rounded", i < pos ? "bg-[#563A9E]" : "bg-slate-200")} />}
            </div>
            <span className={cn("text-[13px]", atual ? "font-semibold text-cataguases-marinho" : feito || proxima ? "text-cataguases-marinho" : "text-slate-500")}>
              {infoEtapa(k, catalogo).nome}
            </span>
            <span className="text-xs text-slate-500">
              {rotulos[k] ?? (i < pos ? "sem registro" : proxima ? (travada ? "bloqueada" : "próxima") : "")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
