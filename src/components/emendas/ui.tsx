import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CATALOGO_PADRAO, infoEtapa, posicaoNaTrilha, trilha, type CatalogoEtapas } from "@/lib/emendas/regras";
import type { FaseCalculada } from "@/lib/emendas/fases";
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
  ajuda,
}: {
  /** "?" com a explicação e a base legal do indicador. */
  ajuda?: ReactNode;
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
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
        {ajuda}
      </span>
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

export type EstadoMarca = "completo" | "parcial" | "alerta" | "pendente";

/** Bolinha de andamento: verde com V = concluído; amarela vazada com V = parcial (ainda há saldo);
 * triângulo amarelo vazado com ! = alerta. */
export function MarcaEstado({ estado, tamanho = 20, presumida }: { estado: EstadoMarca; tamanho?: 20 | 28; presumida?: boolean }) {
  const lado = tamanho === 28 ? "h-7 w-7" : "h-5 w-5";
  const icone = tamanho === 28 ? "h-4 w-4" : "h-3 w-3";
  if (estado === "alerta") return <TriangleAlert className={cn(lado, "text-amber-500")} strokeWidth={2.2} aria-hidden />;
  if (estado === "completo")
    return (
      <span className={cn("flex flex-none items-center justify-center rounded-full", lado, presumida ? "border-2 border-emerald-600 text-emerald-700" : "bg-emerald-600 text-white")}>
        <Check className={icone} strokeWidth={3} aria-hidden />
      </span>
    );
  if (estado === "parcial")
    return (
      <span className={cn("flex flex-none items-center justify-center rounded-full border-2 border-amber-500 text-amber-600", lado)}>
        <Check className={icone} strokeWidth={3} aria-hidden />
      </span>
    );
  return null;
}

/** Estado de uma etapa a partir das fases que pertencem a ela. */
function estadoDaEtapa(fases: FaseCalculada[]): { estado: EstadoMarca; resumo: string; presumida: boolean } {
  const aplicaveis = fases.filter((f) => f.situacao !== "nao_se_aplica");
  const alertas = fases.flatMap((f) => f.alertas);
  const linhas = fases.map((f) => `${f.fase.nome}: ${f.resumo}`);
  const resumo = [...linhas, ...alertas.map((a) => `⚠ ${a}`)].join("\n");
  if (alertas.length > 0) return { estado: "alerta", resumo, presumida: false };
  if (aplicaveis.length === 0) return { estado: "pendente", resumo: resumo || "Não se aplica.", presumida: false };
  const concluidas = aplicaveis.filter((f) => f.situacao === "concluida" && !f.parcial);
  if (concluidas.length === aplicaveis.length) return { estado: "completo", resumo, presumida: false };
  const andou = aplicaveis.some((f) => f.parcial || f.situacao === "em_andamento" || f.situacao === "concluida");
  return { estado: andou ? "parcial" : "pendente", resumo, presumida: false };
}

/** Linha de etapas do detalhe da emenda (stepper). Com `fases`, cada etapa mostra o estado das fases dela
 * (completo, parcial ou alerta) e um resumo ao passar o mouse. */
export function LinhaEtapas({
  modalidade,
  etapa,
  situacao,
  rotulos,
  fases,
  catalogo = CATALOGO_PADRAO,
}: {
  modalidade: Modalidade;
  etapa: EtapaEmenda;
  situacao: SituacaoEmenda;
  /** Texto de apoio por etapa (data, nº do empenho…). */
  rotulos: Partial<Record<EtapaEmenda, string>>;
  fases?: FaseCalculada[];
  catalogo?: CatalogoEtapas;
}) {
  const t = trilha(modalidade, catalogo);
  const pos = posicaoNaTrilha(modalidade, etapa, catalogo);
  const travada = situacao === "impedida";
  const itens = t.map((k, i) => {
    const doGrupo = (fases ?? []).filter((f) => f.fase.etapa === k);
    if (doGrupo.length > 0) return { k, ...estadoDaEtapa(doGrupo) };
    return {
      k,
      estado: (i <= pos ? "completo" : "pendente") as EstadoMarca,
      resumo: i <= pos ? `Etapa registrada${rotulos[k] ? `: ${rotulos[k]}` : ""}.` : "Ainda não iniciada.",
      presumida: false,
    };
  });
  const cor = (e: EstadoMarca) => e === "parcial" || e === "alerta";
  return (
    <ol aria-label="Etapas da emenda" className="grid grid-cols-[repeat(auto-fit,minmax(104px,1fr))] gap-y-3" data-tour="etapas-emenda">
      {itens.map((it, i) => {
        const atual = i === pos;
        const proxima = i === pos + 1 && it.estado === "pendente";
        const tooltip = `${infoEtapa(it.k, catalogo).nome}\n${it.resumo}`;
        const proximo = itens[i + 1];
        const linha = it.estado === "completo" ? "#059669" : cor(it.estado) && proximo && cor(proximo.estado) ? "#F59E0B" : "#E2E8F0";
        return (
          <li key={it.k} className="flex flex-col gap-2 pr-2" aria-current={atual ? "step" : undefined}>
            <div className="flex items-center">
              <span title={tooltip} aria-label={tooltip.replace(/\n/g, " — ")} role="img" className="flex h-7 w-7 flex-none cursor-default items-center justify-center">
                {it.estado === "pendente" ? (
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                      proxima ? (travada ? "border-amber-500 bg-white text-amber-700" : "border-[#6B4FBB] bg-white text-[#6B4FBB]") : "border-slate-300 bg-white text-slate-400"
                    )}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <MarcaEstado estado={it.estado} tamanho={28} presumida={it.presumida} />
                )}
              </span>
              {i < itens.length - 1 && <span className="ml-1.5 h-[3px] flex-1 rounded" style={{ backgroundColor: linha }} />}
            </div>
            <span className={cn("text-[13px]", atual ? "font-semibold text-cataguases-marinho" : it.estado !== "pendente" || proxima ? "text-cataguases-marinho" : "text-slate-500")}>
              {infoEtapa(it.k, catalogo).nome}
            </span>
            <span className="text-xs text-slate-500">
              {rotulos[it.k] ?? (it.estado === "parcial" ? "parcial" : it.estado === "alerta" ? "atenção" : i < pos ? "sem registro" : proxima ? (travada ? "bloqueada" : "próxima") : "")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
