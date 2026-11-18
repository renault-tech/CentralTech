import { listarConciliacoes, listarEmendas, listarEncerramentos } from "@/lib/emendas/dados";
import { agrupar, linhasPanorama, rotuloSituacao, totaisPorCartao, CARTOES, type Cartao, type EmendaPanorama, type LinhaPanorama } from "@/lib/emendas/encerramento";
import { tipoDaEmenda } from "@/lib/emendas/fases";
import type { Conciliacao } from "@/lib/emendas/conciliacao";

/** Linhas do Panorama de um exercício, sob a RLS de quem pede (tela, Excel e PDF usam a mesma origem). */
export async function carregarPanorama(ano: number): Promise<{ linhas: LinhaPanorama[]; conciliacoes: Conciliacao[] }> {
  const resumos = await listarEmendas(ano);
  const ids = resumos.map((e) => e.id);
  const [encerramentos, conciliacoes] = await Promise.all([listarEncerramentos(ids), listarConciliacoes(ids)]);
  const base: EmendaPanorama[] = resumos.map((e) => ({
    id: e.id,
    numero: e.numero,
    objeto: e.objeto,
    vereador_nome: e.vereador_nome,
    secretaria_id: e.secretaria_id,
    secretaria_nome: e.secretaria_nome,
    beneficiario_nome: e.beneficiario_nome,
    tipo_execucao: tipoDaEmenda(e),
    valor: e.valor,
    empenhado: e.empenhado,
    pago: e.pago,
    etapa: e.etapa,
    situacao: e.situacao,
  }));
  return { linhas: linhasPanorama(base, encerramentos, conciliacoes), conciliacoes };
}

export const NOME_DO_CARTAO: Record<Cartao, string> = {
  todas: "Emendas do exercício (valor total)",
  empenhadas: "Empenhado",
  pagas: "Pago",
  a_pagar: "Empenho não pago",
  sem_empenho_andamento: "Sem empenho, emenda em andamento",
  sem_empenho_encerrada: "Sem empenho, emenda encerrada (economia)",
  cumprida: "Emendas cumpridas",
  cumprida_economia: "Cumpridas com economia ou devolução",
  nao_cumprida: "Não cumpridas",
  restos_a_pagar: "Em restos a pagar",
  sem_situacao: "Sem situação definida",
  anular: "Empenho a anular no IPM",
  devolucao: "Devoluções de repasse",
  excesso: "Acima do valor da emenda",
};

export function resumoDoPanorama(linhas: LinhaPanorama[]) {
  const t = totaisPorCartao(linhas);
  return CARTOES.map((c) => ({ chave: c, nome: NOME_DO_CARTAO[c], quantidade: t[c].quantidade, valor: t[c].valor }));
}

export function tabelasAgrupadas(linhas: LinhaPanorama[]) {
  return (["secretaria", "vereador", "tipo"] as const).map((por) => ({
    por,
    titulo: por === "secretaria" ? "Por secretaria" : por === "vereador" ? "Por vereador" : "Por tipo de execução",
    linhas: agrupar(linhas, por),
  }));
}

export const textoSituacao = (l: LinhaPanorama): string => (l.encerramento ? rotuloSituacao(l.encerramento, l.tipo_execucao) : "Sem situação definida");
