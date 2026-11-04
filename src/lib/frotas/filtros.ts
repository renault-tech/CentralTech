/** Filtros das listas do Frotas (puros, testados em `filtros.test.ts`). Os valores vêm da URL. */

import { chaveTexto } from "@/lib/frotas/importacao/normalizar";
import { diasEntre, situacaoManutencao, situacaoNota, type EtapaManutencao, type EtapaNota } from "@/lib/frotas/regras";
import type { Manutencao, NotaCombustivel, Veiculo } from "@/types/frotas";

const contem = (texto: string | null | undefined, busca: string) => chaveTexto(texto ?? "").includes(busca);

// ------------------------------------------------------------- NFs de combustível

export type FiltroNotas = {
  q?: string;
  secretaria?: string;
  /** Início da quinzena (AAAA-MM-DD). */
  quinzena?: string;
  /** Etapa da NF; "todas" mostra também as que já saíram há mais de 30 dias para a Contabilidade. */
  situacao?: EtapaNota | "todas" | "ativas";
};

export const DIAS_NA_LISTA_APOS_CONTABILIDADE = 30;

export function filtrarNotas(
  notas: NotaCombustivel[],
  f: FiltroNotas,
  hoje: string,
  nomes: { secretarias: Map<string, string>; fornecedores: Map<string, string> }
): NotaCombustivel[] {
  const busca = chaveTexto(f.q ?? "");
  const situacao = f.situacao ?? "ativas";
  return notas.filter((n) => {
    if (f.secretaria && n.secretaria_id !== f.secretaria) return false;
    if (f.quinzena && n.periodo_inicio !== f.quinzena) return false;
    const s = situacaoNota(n);
    if (situacao === "ativas") {
      if (s.etapa === "na_contabilidade" && diasEntre(s.desde, hoje) > DIAS_NA_LISTA_APOS_CONTABILIDADE) return false;
    } else if (situacao !== "todas" && s.etapa !== situacao) return false;
    if (busca) {
      const alvo = [n.numero_nf, nomes.secretarias.get(n.secretaria_id), n.fornecedor_id ? nomes.fornecedores.get(n.fornecedor_id) : ""].join(" ");
      if (!contem(alvo, busca)) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------- manutenção

export type FiltroManutencao = {
  q?: string;
  situacao?: "andamento" | "a_analisar" | "aguardando" | "concluidas" | "recusadas" | "todas";
};

const ETAPAS_AGUARDANDO: EtapaManutencao[] = ["oc_emitida"];

export function filtrarManutencoes(
  manutencoes: Manutencao[],
  f: FiltroManutencao,
  nomes: { veiculos: Map<string, Veiculo>; secretarias: Map<string, string> }
): Manutencao[] {
  const busca = chaveTexto(f.q ?? "");
  const situacao = f.situacao ?? "andamento";
  return manutencoes.filter((m) => {
    const s = situacaoManutencao(m);
    if (situacao === "andamento" && !s.emAndamento) return false;
    if (situacao === "a_analisar" && s.etapa !== "a_analisar") return false;
    if (situacao === "aguardando" && !ETAPAS_AGUARDANDO.includes(s.etapa)) return false;
    if (situacao === "concluidas" && s.etapa !== "concluida") return false;
    if (situacao === "recusadas" && s.etapa !== "recusada") return false;
    if (busca) {
      const v = nomes.veiculos.get(m.veiculo_id);
      const alvo = [m.oc_numero, m.nf_numero, m.servico, v?.placa, v?.modelo, nomes.secretarias.get(m.secretaria_id)].join(" ");
      if (!contem(alvo, busca)) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------- veículos

export type FiltroVeiculos = {
  q?: string;
  secretaria?: string;
  situacao?: Veiculo["situacao"];
  vinculo?: Veiculo["vinculo"];
  /** Só os que têm aviso de revisão. */
  revisar?: boolean;
};

export function filtrarVeiculos(veiculos: Veiculo[], f: FiltroVeiculos, comAviso: Set<string>): Veiculo[] {
  const busca = chaveTexto(f.q ?? "");
  return veiculos.filter((v) => {
    if (f.secretaria && v.secretaria_id !== f.secretaria) return false;
    if (f.situacao && v.situacao !== f.situacao) return false;
    if (f.vinculo && v.vinculo !== f.vinculo) return false;
    if (f.revisar && !comAviso.has(v.id)) return false;
    if (busca && !contem([v.placa, v.modelo, v.marca, v.patrimonio].join(" "), busca)) return false;
    return true;
  });
}

// ------------------------------------------------------------- leitura da URL

const um = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const dentro = <T extends string>(v: string | undefined, validos: readonly T[]): T | undefined => (v && (validos as readonly string[]).includes(v) ? (v as T) : undefined);

export function lerFiltroNotas(sp: Record<string, string | string[] | undefined>): FiltroNotas {
  return {
    q: um(sp.q),
    secretaria: um(sp.sec),
    quinzena: /^\d{4}-\d{2}-\d{2}$/.test(um(sp.quinz) ?? "") ? um(sp.quinz) : undefined,
    situacao: dentro(um(sp.sit), ["recebida", "com_secretaria", "assinada", "na_contabilidade", "todas", "ativas"] as const),
  };
}

export function lerFiltroManutencao(sp: Record<string, string | string[] | undefined>): FiltroManutencao {
  return {
    q: um(sp.q),
    situacao: dentro(um(sp.sit), ["andamento", "a_analisar", "aguardando", "concluidas", "recusadas", "todas"] as const),
  };
}

export function lerFiltroVeiculos(sp: Record<string, string | string[] | undefined>): FiltroVeiculos {
  return {
    q: um(sp.q),
    secretaria: um(sp.sec),
    situacao: dentro(um(sp.sit), ["ativo", "em_manutencao", "inativo", "baixado"] as const),
    vinculo: dentro(um(sp.vinc), ["proprio", "convenio", "alugado"] as const),
    revisar: um(sp.rev) === "1",
  };
}
