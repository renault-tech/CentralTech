/**
 * Fases por tipo de execução (direta · OSC · ente) — funções puras, testadas em
 * `fases.test.ts`. Cada dado tem UMA fonte: a fase ligada a um dado que já existe
 * (LOA, parecer, empenho, liquidação, pagamento, termo, extrato) é DERIVADA dele e
 * nunca digitada de novo; as demais são manuais (`emenda_fases`). Sem dado próprio,
 * uma fase anterior à etapa atual da emenda é "presumida" — não deixa a emenda
 * parecer ter regredido enquanto a conferência não é feita.
 */

import { CATALOGO_PADRAO, posicaoNaTrilha, type CatalogoEtapas } from "@/lib/emendas/regras";
import type {
  EmendaResumo,
  ExecucaoEmenda,
  Exercicio,
  FaseEmenda,
  FaseFluxo,
  SituacaoFase,
  TipoExecucao,
} from "@/types/emendas";

export const ORDEM_TIPOS: TipoExecucao[] = ["direta", "osc", "ente"];

/** Cores discretas (faixa de 4px na linha, selo, régua). Fundo/borda, nunca texto sobre cor. */
export const TIPOS_EXECUCAO: Record<TipoExecucao, { nome: string; curto: string; cor: string; descricao: string }> = {
  direta: {
    nome: "Execução direta",
    curto: "Direta",
    cor: "#1D6A8A",
    descricao: "Compra de bens, serviços ou obras pela própria Prefeitura (Lei 14.133/2021).",
  },
  osc: {
    nome: "Repasse a OSC",
    curto: "OSC",
    cor: "#9A5A0E",
    descricao: "Transferência a entidade sem fins lucrativos por termo de fomento ou colaboração (Lei 13.019/2014).",
  },
  ente: {
    nome: "Entes e conveniadas",
    curto: "Ente",
    cor: "#962A52",
    descricao: "Hospitais e instituições conveniadas ao SUS, consórcios públicos e outros entes.",
  },
};

/** Emendas ainda sem tipo (importadas depois da carga): direta se a natureza é de aplicação direta, senão OSC. */
export function tipoDaEmenda(e: Pick<EmendaResumo, "tipo_execucao" | "modalidade">): TipoExecucao {
  return e.tipo_execucao ?? (e.modalidade === "direta" ? "direta" : "osc");
}

export type OrigemFase = "manual" | "derivada" | "presumida" | "nenhuma";

export type FaseCalculada = {
  fase: FaseFluxo;
  situacao: SituacaoFase;
  origem: OrigemFase;
  data: string | null;
  documento: string | null;
  observacao: string | null;
};

export type EntradaFases = {
  emenda: Pick<EmendaResumo, "tipo_execucao" | "modalidade" | "etapa" | "impedimentos_abertos">;
  /** Fases do tipo da emenda (catálogo `fluxo_fases`). */
  fases: FaseFluxo[];
  manuais: Map<string, FaseEmenda>;
  movimentos: { tipo: string; data: string | null }[];
  execucao: Pick<ExecucaoEmenda, "numero_termo" | "vigencia_inicio" | "data_publicacao_extrato"> | null;
  exercicio: Pick<Exercicio, "data_aprovacao_loa"> | null;
  parecer: { data: string } | null;
  catalogo?: CatalogoEtapas;
};

const MOV_POR_DERIVACAO: Record<string, string> = { empenho: "empenho", liquidacao: "liquidacao", pagamento: "pagamento" };

function menorData(movs: { tipo: string; data: string | null }[], tipo: string): string | null {
  let achou = false;
  let menor: string | null = null;
  for (const m of movs) {
    if (m.tipo !== tipo) continue;
    achou = true;
    if (m.data && (!menor || m.data < menor)) menor = m.data;
  }
  return achou ? (menor ?? "") : null; // "" = existe movimento, sem data informada
}

/** Dado real que fecha a fase derivada; `null` = não há dado. */
function dadoDerivado(f: FaseFluxo, e: EntradaFases): { data: string | null } | { aberta: true } | null {
  switch (f.derivacao) {
    case "loa":
      return { data: e.exercicio?.data_aprovacao_loa ?? null };
    case "parecer":
      if (e.parecer) return { data: e.parecer.data };
      return e.emenda.impedimentos_abertos > 0 ? { aberta: true } : null;
    case "empenho":
    case "liquidacao":
    case "pagamento": {
      const d = menorData(e.movimentos, MOV_POR_DERIVACAO[f.derivacao]);
      return d === null ? null : { data: d || null };
    }
    case "termo":
      return e.execucao?.numero_termo ? { data: e.execucao.vigencia_inicio } : null;
    case "extrato":
      return e.execucao?.data_publicacao_extrato ? { data: e.execucao.data_publicacao_extrato } : null;
    default:
      return null;
  }
}

export function situacaoFases(entrada: EntradaFases): FaseCalculada[] {
  const cat = entrada.catalogo ?? CATALOGO_PADRAO;
  const { emenda } = entrada;
  const posAtual = posicaoNaTrilha(emenda.modalidade, emenda.etapa, cat);

  return entrada.fases
    .filter((f) => f.ativa)
    .sort((a, b) => a.ordem - b.ordem)
    .map((fase): FaseCalculada => {
      const manual = entrada.manuais.get(fase.chave);
      const base = { fase, data: null, documento: null, observacao: null };
      const real = dadoDerivado(fase, entrada);

      if (real && "data" in real) {
        return { ...base, situacao: "concluida", origem: "derivada", data: real.data, observacao: manual?.observacao ?? null };
      }
      if (manual) {
        return {
          ...base,
          situacao: manual.situacao,
          origem: "manual",
          data: manual.data,
          documento: manual.documento,
          observacao: manual.observacao,
        };
      }
      if (real && "aberta" in real) return { ...base, situacao: "em_andamento", origem: "derivada" };

      // Sem dado próprio: a etapa atual da emenda já passou por aqui?
      const posFase = posicaoNaTrilha(emenda.modalidade, fase.etapa, cat);
      const financeira = fase.derivacao === "empenho" || fase.derivacao === "liquidacao" || fase.derivacao === "pagamento";
      if (posFase >= 0 && posAtual >= 0 && (posFase < posAtual || (financeira && posFase === posAtual))) {
        return { ...base, situacao: "concluida", origem: "presumida" };
      }
      return { ...base, situacao: "pendente", origem: "nenhuma" };
    });
}

export function progresso(fases: FaseCalculada[]): { concluidas: number; total: number } {
  const aplicaveis = fases.filter((f) => f.situacao !== "nao_se_aplica");
  return { concluidas: aplicaveis.filter((f) => f.situacao === "concluida").length, total: aplicaveis.length };
}

/** Primeira fase aplicável ainda não concluída (a próxima a fazer). */
export function faseAtual(fases: FaseCalculada[]): FaseCalculada | null {
  return fases.find((f) => f.situacao !== "nao_se_aplica" && f.situacao !== "concluida") ?? null;
}

/** Datas informadas que andam para trás em relação à ordem do fluxo. */
export function datasForaDeOrdem(fases: FaseCalculada[]): [FaseCalculada, FaseCalculada][] {
  const comData = fases.filter((f) => f.situacao === "concluida" && f.data && f.origem !== "presumida");
  const out: [FaseCalculada, FaseCalculada][] = [];
  for (let i = 1; i < comData.length; i++) {
    const anterior = comData[i - 1];
    if ((comData[i].data as string) < (anterior.data as string)) out.push([anterior, comData[i]]);
  }
  return out;
}

/** Mapa chave → fase manual, a partir das linhas de `emenda_fases` de UMA emenda. */
export function mapaManuais(linhas: FaseEmenda[]): Map<string, FaseEmenda> {
  return new Map(linhas.map((l) => [l.chave, l]));
}

/** Etapa (cache `emendas.etapa`) que a emenda deve ter ao concluir esta fase, se avançar. */
export function etapaAoConcluir(fase: FaseFluxo, etapaAtual: string, modalidade: EmendaResumo["modalidade"], cat: CatalogoEtapas): string | null {
  const posFase = posicaoNaTrilha(modalidade, fase.etapa, cat);
  const posAtual = posicaoNaTrilha(modalidade, etapaAtual, cat);
  return posFase > posAtual ? fase.etapa : null;
}
