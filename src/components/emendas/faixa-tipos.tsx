import Link from "next/link";

import { ORDEM_TIPOS, TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { brlCurto, dataBr, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import type { EmendaResumo, Exercicio } from "@/types/emendas";

/** Régua do exercício (LOA → prazo de exequibilidade → fim do ano) e um cartão por
 * tipo de execução. Cada cartão leva à lista já filtrada pelo tipo. */
export function FaixaTipos({
  emendas,
  resumos,
  exercicio,
  hoje,
}: {
  emendas: EmendaResumo[];
  resumos: Record<string, ResumoLinha>;
  exercicio: Exercicio;
  hoje: string;
}) {
  const marcos = [
    { rotulo: "LOA aprovada", data: exercicio.data_aprovacao_loa },
    { rotulo: "Prazo de exequibilidade", data: exercicio.prazo_exequibilidade },
    { rotulo: "Fim do exercício", data: `${exercicio.ano}-12-31` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-slate-600" aria-label="Datas do exercício">
        {marcos.map((m) => (
          <li key={m.rotulo} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.data && m.data <= hoje ? "#16A34A" : "#94A3B8" }} aria-hidden />
            {m.rotulo}:{" "}
            <strong className="font-medium text-cataguases-marinho">
              {m.data ? dataBr(m.data) : <span className="font-normal text-slate-500">a informar em Configurações</span>}
            </strong>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 sm:grid-cols-3">
        {ORDEM_TIPOS.map((tipo) => {
          const t = TIPOS_EXECUCAO[tipo];
          const doTipo = emendas.filter((e) => tipoDaEmenda(e) === tipo);
          const valor = doTipo.reduce((s, e) => s + e.valor, 0);
          const pago = doTipo.reduce((s, e) => s + e.pago, 0);
          const comPendencia = doTipo.filter((e) => (resumos[e.id]?.abertas ?? 0) > 0).length;
          const altas = doTipo.filter((e) => resumos[e.id]?.gravidade === "alta").length;
          return (
            <Link
              key={tipo}
              href={`/emendas/lista?t=${tipo}&ano=${exercicio.ano}`}
              className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
              style={{ borderLeft: `4px solid ${t.cor}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-cataguases-marinho">{t.nome}</h3>
                <span className="text-xs tabular-nums text-slate-600">{doTipo.length} emendas</span>
              </div>
              <p className="mt-1 text-xl font-semibold tabular-nums text-cataguases-marinho">{brlCurto(valor)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${pct(pago / (valor || 1))} pago`}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pago / (valor || 1)) * 100)}%`, backgroundColor: t.cor }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                {pct(pago / (valor || 1))} pago ·{" "}
                {comPendencia ? (
                  <span className={altas ? "font-medium text-red-700" : ""}>
                    {comPendencia} com pendência{altas ? ` (${altas} alta${altas === 1 ? "" : "s"})` : ""}
                  </span>
                ) : (
                  "sem pendências"
                )}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
