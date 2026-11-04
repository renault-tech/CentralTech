/**
 * Leitura da planilha "TODOS OS VEÍCULOS DA PREFEITURA" (uma aba para os
 * próprios, outra para os de convênio e outra para os alugados). Aqui só a
 * interpretação, sobre matrizes de texto — a leitura do .xlsx fica em `xlsx.ts`.
 * As abas são reconhecidas pelas colunas (patrimônio = próprios, setor =
 * convênio, locadora = alugados), não pelo nome.
 */

import {
  chaveTexto,
  limpar,
  normalizarAnos,
  normalizarClassificacao,
  normalizarCombustivel,
  normalizarMarca,
  normalizarPatrimonio,
  normalizarPlaca,
  normalizarSecretaria,
  interpretarSituacao,
} from "@/lib/frotas/importacao/normalizar";
import type { Classificacao, Combustivel, SituacaoVeiculo, Vinculo } from "@/types/frotas";

export type VeiculoImportado = {
  aba: string;
  linha: number;
  vinculo: Vinculo;
  placa: string | null;
  modelo: string;
  marca: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  combustivel: Combustivel | null;
  classificacao: Classificacao | null;
  patrimonio: string | null;
  secretaria: string;
  setor: string | null;
  situacao: SituacaoVeiculo;
  motivo_situacao: string | null;
  finalidade: string | null;
  locadora: string | null;
  origem: string;
};

export type AbaLida = { nome: string; vinculo: Vinculo | null; lidos: number };

export type ResultadoLeitura = {
  veiculos: VeiculoImportado[];
  abas: AbaLida[];
  /** Secretarias que o catálogo não conhece (o importador cria). */
  secretariasNovas: string[];
  avisos: string[];
};

export type AbaBruta = { nome: string; linhas: string[][] };

type Coluna = "placa" | "modelo" | "combustivel" | "ano" | "marca" | "classificacao" | "patrimonio" | "secretaria" | "setor" | "situacao" | "finalidade" | "locadora";

function colunaDoCabecalho(texto: string): Coluna | null {
  const k = chaveTexto(texto);
  if (k === "placa") return "placa";
  if (k === "modelo") return "modelo";
  if (k.startsWith("combut") || k.startsWith("combust")) return "combustivel";
  if (k === "ano") return "ano";
  if (k === "marca") return "marca";
  if (k === "classificacao") return "classificacao";
  if (k === "patrimonio") return "patrimonio";
  if (k === "secretaria") return "secretaria";
  if (k === "setor") return "setor";
  if (k === "situacaoatual" || k === "situacao") return "situacao";
  if (k === "finalidade") return "finalidade";
  if (k === "locadora") return "locadora";
  return null;
}

function vinculoDaAba(nome: string, colunas: Set<Coluna>): Vinculo | null {
  if (colunas.has("locadora")) return "alugado";
  if (colunas.has("setor")) return "convenio";
  if (colunas.has("patrimonio")) return "proprio";
  const k = chaveTexto(nome);
  if (k.includes("alugad")) return "alugado";
  if (k.includes("convenio")) return "convenio";
  if (k.includes("propri")) return "proprio";
  return null;
}

const ROTULO_VINCULO: Record<Vinculo, string> = { proprio: "Próprios", convenio: "Convênio", alugado: "Alugados" };

/** Chave que identifica um veículo na reimportação (a mesma planilha não duplica ninguém). */
export function chaveVeiculo(v: Pick<VeiculoImportado, "vinculo" | "placa" | "patrimonio" | "modelo" | "ano_modelo">): string {
  return [v.vinculo, chaveTexto(v.placa ?? ""), v.patrimonio ?? "", chaveTexto(v.modelo), v.ano_modelo ?? ""].join("|");
}

export function interpretarPlanilha(abas: AbaBruta[]): ResultadoLeitura {
  const veiculos: VeiculoImportado[] = [];
  const lidas: AbaLida[] = [];
  const novas = new Set<string>();
  const avisos: string[] = [];

  for (const aba of abas) {
    const posCabecalho = aba.linhas.slice(0, 15).findIndex((l) => l.some((c) => chaveTexto(c) === "placa"));
    if (posCabecalho < 0) {
      lidas.push({ nome: aba.nome, vinculo: null, lidos: 0 });
      avisos.push(`A aba “${aba.nome}” não tem uma coluna PLACA e foi ignorada.`);
      continue;
    }

    const indice = new Map<Coluna, number>();
    aba.linhas[posCabecalho].forEach((texto, i) => {
      const col = colunaDoCabecalho(texto);
      if (col && !indice.has(col)) indice.set(col, i);
    });
    const vinculo = vinculoDaAba(aba.nome, new Set(indice.keys()));
    if (!vinculo) {
      lidas.push({ nome: aba.nome, vinculo: null, lidos: 0 });
      avisos.push(`Não foi possível saber se a aba “${aba.nome}” é de veículos próprios, de convênio ou alugados.`);
      continue;
    }
    if (!indice.has("modelo")) {
      lidas.push({ nome: aba.nome, vinculo, lidos: 0 });
      avisos.push(`A aba “${aba.nome}” não tem uma coluna MODELO e foi ignorada.`);
      continue;
    }

    const cel = (linha: string[], col: Coluna): string => {
      const i = indice.get(col);
      return i === undefined ? "" : limpar(linha[i]);
    };

    let lidos = 0;
    for (let i = posCabecalho + 1; i < aba.linhas.length; i++) {
      const linha = aba.linhas[i];
      // O resumo "Secretaria | Quantidade de Veículos" no pé da aba não é veículo.
      if (chaveTexto(linha[0] ?? "") === "secretaria" && chaveTexto(linha[1] ?? "").startsWith("quantidade")) break;
      const modelo = cel(linha, "modelo");
      if (!modelo) continue; // linha em branco ou só com "PROPRIO"

      const marca = normalizarMarca(cel(linha, "marca"));
      const anos = normalizarAnos(cel(linha, "ano"));
      const sec = normalizarSecretaria(cel(linha, "secretaria"), cel(linha, "setor"));
      if (sec.nova) novas.add(sec.secretaria);
      const situacao = interpretarSituacao(cel(linha, "situacao"), cel(linha, "finalidade"));
      const locadora = cel(linha, "locadora");

      veiculos.push({
        aba: aba.nome,
        linha: i + 1,
        vinculo,
        placa: normalizarPlaca(cel(linha, "placa")),
        modelo,
        marca,
        ano_fabricacao: anos.fabricacao,
        ano_modelo: anos.modelo,
        combustivel: normalizarCombustivel(cel(linha, "combustivel")),
        classificacao: normalizarClassificacao(cel(linha, "classificacao"), modelo, marca),
        patrimonio: normalizarPatrimonio(cel(linha, "patrimonio")),
        secretaria: sec.secretaria,
        setor: sec.setor,
        situacao: situacao.situacao,
        motivo_situacao: situacao.motivo,
        finalidade: situacao.finalidade,
        locadora: locadora || null,
        origem: `Planilha · ${ROTULO_VINCULO[vinculo]}`,
      });
      lidos += 1;
    }
    lidas.push({ nome: aba.nome, vinculo, lidos });
    if (vinculo === "alugado" && veiculos.some((v) => v.aba === aba.nome && !v.locadora)) {
      avisos.push(`Há veículos alugados sem locadora na aba “${aba.nome}”; eles não poderão ser importados.`);
    }
  }

  return { veiculos, abas: lidas, secretariasNovas: [...novas], avisos };
}
