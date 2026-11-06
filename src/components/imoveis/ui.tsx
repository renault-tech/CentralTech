import { Selo, SeloNivel } from "@/components/modulo/ui";
import type { Pendencia } from "@/lib/imoveis/regras";
import type { SituacaoImovel } from "@/types/imoveis";

export * from "@/components/modulo/ui";

export const ROTULO_SITUACAO: Record<SituacaoImovel, string> = { ativo: "Ativo", em_entrega: "Em entrega", entregue: "Entregue" };

export function SeloSituacaoImovel({ situacao }: { situacao: SituacaoImovel }) {
  const tom = situacao === "ativo" ? "verde" : situacao === "em_entrega" ? "ambar" : "neutro";
  return <Selo tom={tom}>{ROTULO_SITUACAO[situacao]}</Selo>;
}

export function SeloGravidade({ nivel }: { nivel: Pendencia["nivel"] }) {
  return <SeloNivel nivel={nivel === "critico" ? "critico" : "atencao"}>{nivel === "critico" ? "Crítico" : "Atenção"}</SeloNivel>;
}
