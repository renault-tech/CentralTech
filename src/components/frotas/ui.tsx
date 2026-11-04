import Link from "next/link";

import { cn } from "@/lib/utils";
import type { NivelAlerta } from "@/components/modulo/ui";
import type { SituacaoVeiculo } from "@/types/frotas";
import { Selo } from "@/components/modulo/ui";

/** O kit visual comum (botões, cartão, selos, título, campo, mensagem) mora em `components/modulo/ui`;
 * aqui ficam só as peças que são do Frotas. */
export {
  CLASSE_BOTAO,
  CLASSE_BOTAO_COMPACTO,
  CLASSE_BOTAO_PERIGO,
  CLASSE_BOTAO_SECUNDARIO,
  Campo,
  Cartao,
  Mensagem,
  Selo,
  SeloDias,
  SeloNivel,
  TituloPagina,
  Vazio,
} from "@/components/modulo/ui";

export const ROTULO_SITUACAO_VEICULO: Record<SituacaoVeiculo, string> = {
  ativo: "Ativo",
  em_manutencao: "Em manutenção",
  inativo: "Inativo",
  baixado: "Baixado",
};

export function SeloSituacaoVeiculo({ situacao }: { situacao: SituacaoVeiculo }) {
  const tom = situacao === "ativo" ? "verde" : situacao === "em_manutencao" ? "ambar" : "neutro";
  return <Selo tom={tom}>{ROTULO_SITUACAO_VEICULO[situacao]}</Selo>;
}

/** Cartão-número do painel; leva à lista filtrada. */
export function CartaoNumero({ rotulo, valor, nota, href, destaque }: { rotulo: string; valor: number; nota: string; href: string; destaque?: boolean }) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 transition-colors duration-200 hover:border-[color:var(--modulo)] hover:bg-slate-50"
    >
      <span className="text-xs font-medium text-slate-600">{rotulo}</span>
      <span className={cn("text-3xl font-bold tabular-nums tracking-tight", destaque ? "text-red-700" : "text-cataguases-marinho")}>{valor}</span>
      <span className="text-xs text-slate-500">{nota}</span>
    </Link>
  );
}

export function Barra({ valor, nivel = "ok", marcaEm }: { valor: number; nivel?: NivelAlerta; marcaEm?: number }) {
  const cor = nivel === "critico" ? "#B42318" : nivel === "atencao" ? "#B7791F" : "var(--modulo)";
  return (
    <span className="relative block h-2 w-full rounded-full bg-slate-200" aria-hidden>
      <span className="block h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, valor))}%`, backgroundColor: cor }} />
      {marcaEm !== undefined && <span className="absolute -top-[3px] h-3.5 w-0.5 bg-amber-600" style={{ left: `${marcaEm}%` }} />}
    </span>
  );
}
