import { SeloNivel } from "@/components/modulo/ui";
import { formatarData } from "@/lib/frotas/regras";
import { etapasDaEntrega } from "@/lib/imoveis/regras";
import type { Entrega } from "@/types/imoveis";

const ESTILO = {
  feita: "border-green-600 bg-green-600 text-white",
  agora: "border-[color:var(--modulo)] bg-white text-[color:var(--modulo-tinta)]",
  alerta: "border-red-600 bg-white text-red-700",
  pendente: "border-slate-300 bg-white text-slate-400",
} as const;

/** As 8 etapas da entrega em linha do tempo vertical (servidor, só leitura). */
export function EtapasEntrega({ entrega }: { entrega: Entrega | null }) {
  const etapas = etapasDaEntrega(entrega);
  return (
    <ol className="flex flex-col">
      {etapas.map((e, i) => (
        <li key={e.chave} className="relative grid grid-cols-[28px_1fr_auto] gap-3 pb-4 last:pb-0">
          {i < etapas.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-slate-200" />}
          <span className={`z-[1] grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-bold ${ESTILO[e.estado]}`}>{e.estado === "feita" ? "✓" : i + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cataguases-marinho">{e.nome}</p>
            <p className="text-[13px] text-slate-600">
              {e.data ? formatarData(e.data) : "—"}
              {e.detalhe ? ` · ${e.detalhe}` : ""}
            </p>
          </div>
          <div>
            {e.estado === "feita" && <SeloNivel nivel="ok">Concluída</SeloNivel>}
            {e.estado === "agora" && <SeloNivel nivel="atencao">Em andamento</SeloNivel>}
            {e.estado === "alerta" && <SeloNivel nivel="critico">Pendente</SeloNivel>}
          </div>
        </li>
      ))}
    </ol>
  );
}
