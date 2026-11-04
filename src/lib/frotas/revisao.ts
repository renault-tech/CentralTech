/**
 * Dados a revisar no cadastro de veículos. A importação da planilha não corrige
 * nada sozinha: cada ponto duvidoso vira um aviso que continua visível até o
 * dado ser corrigido (ou até alguém marcar "está correto" — `revisao_ignorada`).
 * Função pura, calculada sobre a lista inteira (as repetições dependem dos outros veículos).
 */

import type { Veiculo } from "@/types/frotas";

export type CodigoRevisao =
  | "placa_repetida"
  | "patrimonio_repetido"
  | "patrimonio_zerado"
  | "patrimonio_fora_padrao"
  | "sem_placa"
  | "sem_ano"
  | "sem_combustivel";

export type AvisoRevisao = { codigo: CodigoRevisao; texto: string };

export const ORDEM_REVISAO: CodigoRevisao[] = [
  "placa_repetida",
  "patrimonio_repetido",
  "patrimonio_zerado",
  "patrimonio_fora_padrao",
  "sem_placa",
  "sem_ano",
  "sem_combustivel",
];

const ROTULOS: Record<CodigoRevisao, [singular: string, plural: string]> = {
  placa_repetida: ["placa repetida", "placas repetidas"],
  patrimonio_repetido: ["patrimônio repetido", "patrimônios repetidos"],
  patrimonio_zerado: ["patrimônio zerado", "patrimônios zerados"],
  patrimonio_fora_padrao: ["patrimônio fora do padrão", "patrimônios fora do padrão"],
  sem_placa: ["veículo sem placa", "veículos sem placa"],
  sem_ano: ["sem ano de fabricação", "sem ano de fabricação"],
  sem_combustivel: ["sem combustível", "sem combustível"],
};

export function rotuloRevisao(codigo: CodigoRevisao, n: number): string {
  return ROTULOS[codigo][n === 1 ? 0 : 1];
}

/** Placa só com letras e números, maiúscula — para comparar "QQB-9947" com "qqb 9947". */
export function chavePlaca(placa: string | null | undefined): string {
  return (placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const ZERADO = /^0+$/;

function patrimonioForaDoPadrao(patrimonio: string, placa: string | null): boolean {
  if (!/^\d+$/.test(patrimonio) || ZERADO.test(patrimonio)) return false;
  // Os números de patrimônio da frota têm 5 a 7 dígitos; mais que isso é digitação.
  if (patrimonio.length >= 9) return true;
  // Patrimônio que termina com os 4 dígitos da placa costuma ser a placa digitada no lugar.
  const p = chavePlaca(placa);
  const finalPlaca = p.slice(-4);
  return p.length >= 7 && /^\d{4}$/.test(finalPlaca) && patrimonio.length === 7 && patrimonio.endsWith(finalPlaca);
}

function agrupar(veiculos: Veiculo[], chave: (v: Veiculo) => string | null): Map<string, Veiculo[]> {
  const grupos = new Map<string, Veiculo[]>();
  for (const v of veiculos) {
    const k = chave(v);
    if (!k) continue;
    const lista = grupos.get(k);
    if (lista) lista.push(v);
    else grupos.set(k, [v]);
  }
  return grupos;
}

const nomeDoVeiculo = (v: Veiculo) => v.placa ?? `${v.modelo}${v.patrimonio ? ` (patrimônio ${v.patrimonio})` : ""}`;

/** Avisos de cada veículo (id → avisos), já sem os que a pessoa marcou como corretos. */
export function revisarVeiculos(veiculos: Veiculo[]): Map<string, AvisoRevisao[]> {
  const porPlaca = agrupar(veiculos, (v) => chavePlaca(v.placa) || null);
  const porPatrimonio = agrupar(veiculos, (v) => (v.patrimonio && !ZERADO.test(v.patrimonio) ? v.patrimonio : null));

  const resultado = new Map<string, AvisoRevisao[]>();
  for (const v of veiculos) {
    const avisos: AvisoRevisao[] = [];

    const mesmaPlaca = porPlaca.get(chavePlaca(v.placa));
    if (v.placa && mesmaPlaca && mesmaPlaca.length > 1) {
      avisos.push({ codigo: "placa_repetida", texto: "Placa repetida em outro cadastro" });
    }
    if (!v.placa) avisos.push({ codigo: "sem_placa", texto: "Sem placa" });

    if (v.patrimonio) {
      if (ZERADO.test(v.patrimonio)) {
        avisos.push({ codigo: "patrimonio_zerado", texto: "Patrimônio zerado" });
      } else {
        const iguais = porPatrimonio.get(v.patrimonio) ?? [];
        if (iguais.length > 1) {
          const outros = iguais.filter((o) => o.id !== v.id).map(nomeDoVeiculo).join(", ");
          avisos.push({ codigo: "patrimonio_repetido", texto: `Patrimônio ${v.patrimonio} repetido (${outros})` });
        }
        if (patrimonioForaDoPadrao(v.patrimonio, v.placa)) {
          avisos.push({ codigo: "patrimonio_fora_padrao", texto: `Patrimônio ${v.patrimonio} fora do padrão` });
        }
      }
    }

    if (v.ano_fabricacao === null && v.ano_modelo === null) avisos.push({ codigo: "sem_ano", texto: "Sem ano de fabricação" });
    if (v.combustivel === null) avisos.push({ codigo: "sem_combustivel", texto: "Sem combustível informado" });

    const ignorados = new Set(v.revisao_ignorada);
    const visiveis = avisos.filter((a) => !ignorados.has(a.codigo));
    if (visiveis.length > 0) resultado.set(v.id, visiveis);
  }
  return resultado;
}

export type ResumoRevisao = { codigo: CodigoRevisao; n: number; rotulo: string };

/** Contagem por tipo para o quadro "dados a revisar". Repetição conta o valor repetido (1 placa, 3 patrimônios), os demais contam veículos. */
export function resumirRevisao(veiculos: Veiculo[], avisos: Map<string, AvisoRevisao[]>): ResumoRevisao[] {
  const porId = new Map(veiculos.map((v) => [v.id, v]));
  const contagem = new Map<CodigoRevisao, Set<string>>();
  for (const [id, lista] of avisos) {
    const v = porId.get(id);
    if (!v) continue;
    for (const a of lista) {
      const chave =
        a.codigo === "placa_repetida" ? chavePlaca(v.placa) : a.codigo === "patrimonio_repetido" ? (v.patrimonio ?? id) : id;
      const conjunto = contagem.get(a.codigo) ?? new Set<string>();
      conjunto.add(chave);
      contagem.set(a.codigo, conjunto);
    }
  }
  return ORDEM_REVISAO.filter((c) => contagem.has(c)).map((c) => {
    const n = contagem.get(c)!.size;
    return { codigo: c, n, rotulo: rotuloRevisao(c, n) };
  });
}
