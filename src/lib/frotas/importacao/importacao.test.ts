import { describe, expect, it } from "vitest";

import {
  interpretarSituacao,
  normalizarAnos,
  normalizarClassificacao,
  normalizarCombustivel,
  normalizarMarca,
  normalizarPatrimonio,
  normalizarPlaca,
  normalizarSecretaria,
} from "@/lib/frotas/importacao/normalizar";
import { chaveVeiculo, interpretarPlanilha, type AbaBruta } from "@/lib/frotas/importacao/planilha";

describe("normalizarPlaca", () => {
  it("padroniza espaços e hífen (os formatos digitados à mão)", () => {
    expect(normalizarPlaca("QOR - 2576")).toBe("QOR-2576");
    expect(normalizarPlaca("HLF 9820")).toBe("HLF-9820");
    expect(normalizarPlaca("HLF- 8906")).toBe("HLF-8906");
    expect(normalizarPlaca("RUE 4G65")).toBe("RUE-4G65");
    expect(normalizarPlaca("SHZ-8I73")).toBe("SHZ-8I73");
    expect(normalizarPlaca("qqb-9947")).toBe("QQB-9947");
  });
  it("mantém o número de frota das máquinas e trata '-' como sem placa", () => {
    expect(normalizarPlaca("973")).toBe("973");
    expect(normalizarPlaca("LW180KV")).toBe("LW180KV");
    expect(normalizarPlaca("R/LIPPEL PTU 300")).toBe("R/LIPPEL PTU 300");
    expect(normalizarPlaca("-")).toBeNull();
    expect(normalizarPlaca("  ")).toBeNull();
  });
});

describe("combustível, ano e marca", () => {
  it("unifica as grafias do diesel e do flex", () => {
    expect(normalizarCombustivel("DISEL S10")).toBe("diesel_s10");
    expect(normalizarCombustivel("Diesel S10")).toBe("diesel_s10");
    expect(normalizarCombustivel("DIESEL")).toBe("diesel");
    expect(normalizarCombustivel("Gasolina/álcool")).toBe("flex");
    expect(normalizarCombustivel("FLEX")).toBe("flex");
    expect(normalizarCombustivel("Gasolina")).toBe("gasolina");
    expect(normalizarCombustivel("")).toBeNull();
  });
  it("separa o ano de fabricação do ano do modelo", () => {
    expect(normalizarAnos("2023/24")).toEqual({ fabricacao: 2023, modelo: 2024 });
    expect(normalizarAnos("2018/2018")).toEqual({ fabricacao: 2018, modelo: 2018 });
    expect(normalizarAnos("2010")).toEqual({ fabricacao: 2010, modelo: 2010 });
    expect(normalizarAnos("")).toEqual({ fabricacao: null, modelo: null });
    expect(normalizarAnos("0000")).toEqual({ fabricacao: null, modelo: null });
  });
  it("corrige os nomes de marca digitados errado", () => {
    expect(normalizarMarca("Volksvagen")).toBe("Volkswagen");
    expect(normalizarMarca("VOLKSWAGEN")).toBe("Volkswagen");
    expect(normalizarMarca("Renaut")).toBe("Renault");
    expect(normalizarMarca("GM/CHEVROLET")).toBe("Chevrolet");
    expect(normalizarMarca("FIAT IVECO")).toBe("Iveco");
    expect(normalizarMarca("NEW HOLAND")).toBe("New Holland");
    expect(normalizarMarca("")).toBeNull();
  });
  it("tira o '.0' que o Excel põe no patrimônio", () => {
    expect(normalizarPatrimonio("1120099.0")).toBe("1120099");
    expect(normalizarPatrimonio(" 0000000 ")).toBe("0000000");
    expect(normalizarPatrimonio("")).toBeNull();
  });
});

describe("classificação", () => {
  it("unifica leve/leves e reconhece a máquina", () => {
    expect(normalizarClassificacao("LEVES", "Uno", "Fiat")).toBe("leve");
    expect(normalizarClassificacao("Leves", "Uno", "Fiat")).toBe("leve");
    expect(normalizarClassificacao("PESADO ", "Master", "Renault")).toBe("pesado");
    expect(normalizarClassificacao("MÁQUINAS", "TRATOR", "LS")).toBe("maquina");
  });
  it("separa as motos, que a planilha chama de leve", () => {
    expect(normalizarClassificacao("LEVE", "YBR", "Yamaha")).toBe("moto");
    expect(normalizarClassificacao("LEVE", "CG 160 Start", "Honda")).toBe("moto");
    expect(normalizarClassificacao("LEVES", "Bros/honda", "Honda")).toBe("moto");
    expect(normalizarClassificacao("LEVE", "MOTOCICLETA", "Honda")).toBe("moto");
    expect(normalizarClassificacao("PESADO", "MOTONIVELADORA PATROL RG170B", "New Holland")).toBe("pesado");
  });
});

describe("secretaria e setor", () => {
  it("separa a Saúde dos seus setores", () => {
    expect(normalizarSecretaria("SAUDE / PSF")).toEqual({ secretaria: "Saúde", setor: "PSF", nova: false });
    expect(normalizarSecretaria("SAÚDE - TFD")).toEqual({ secretaria: "Saúde", setor: "TFD", nova: false });
    expect(normalizarSecretaria("SAUDE / Policlinica")).toMatchObject({ secretaria: "Saúde", setor: "Policlínica" });
    expect(normalizarSecretaria("SAUDE / CAPS AD")).toMatchObject({ setor: "CAPS AD" });
    expect(normalizarSecretaria("SAUDE / VIGILANCIA")).toMatchObject({ setor: "Vigilância" });
  });
  it("corrige o erro de digitação e usa o setor da coluna própria", () => {
    expect(normalizarSecretaria("ADMINISTRÇÃO", "CORPO DE BOMBEIRO")).toEqual({ secretaria: "Administração", setor: "Corpo de Bombeiros", nova: false });
    expect(normalizarSecretaria("GABINETE", "DEFESA CIVIL")).toMatchObject({ secretaria: "Gabinete", setor: "Defesa Civil" });
    expect(normalizarSecretaria("ASSISTENCIA SOCIAL")).toMatchObject({ secretaria: "Assistência Social", setor: null });
    expect(normalizarSecretaria("SERVIÇOS URBANOS")).toMatchObject({ secretaria: "Serviços Urbanos" });
  });
  it("Conselho Tutelar vira setor do Gabinete", () => {
    expect(normalizarSecretaria("CONSELHO TUTELAR")).toEqual({ secretaria: "Gabinete", setor: "Conselho Tutelar", nova: false });
  });
  it("avisa de secretaria desconhecida", () => {
    expect(normalizarSecretaria("TURISMO")).toEqual({ secretaria: "Turismo", setor: null, nova: true });
  });
});

describe("situação do veículo", () => {
  it("move o motivo da parada para fora da finalidade", () => {
    expect(interpretarSituacao("Inativo", "VEÍCULO AGUARDANDO LEILÃO. ")).toEqual({
      situacao: "inativo",
      motivo: "VEÍCULO AGUARDANDO LEILÃO.",
      finalidade: null,
    });
    expect(interpretarSituacao("Inativo", "Esta parado,aguardando processo que esta em andamento")).toMatchObject({ situacao: "inativo", finalidade: null });
  });
  it("'em manutenção' na finalidade muda a situação de um veículo ativo", () => {
    expect(interpretarSituacao("Ativo", "VEÍCULO EM MANUTENÇÃO.")).toMatchObject({ situacao: "em_manutencao", motivo: "VEÍCULO EM MANUTENÇÃO." });
    expect(interpretarSituacao("Inativo", "VEÍCULO EM MANUTENÇÃO.")).toMatchObject({ situacao: "inativo" });
  });
  it("finalidade comum fica como está", () => {
    expect(interpretarSituacao("Em Manutenção", "Atende as demandas da secretaria")).toEqual({
      situacao: "em_manutencao",
      motivo: null,
      finalidade: "Atende as demandas da secretaria",
    });
    expect(interpretarSituacao("ATIVO ", "")).toEqual({ situacao: "ativo", motivo: null, finalidade: null });
  });
});

const CAB_PROPRIOS = ["PLACA ", "MODELO", "COMBUT.", "ANO", "MARCA", "CLASSIFICAÇÃO ", "PATRIMONIO ", "SECRETARIA ", "SITUAÇÃO ATUAL", "FINALIDADE", "VEICULO É"];
const CAB_CONVENIO = ["PLACA ", "MODELO", "COMBUT.", "ANO", "MARCA", "CLASSIFICAÇÃO ", "SECRETARIA", "SETOR", "SITUAÇÃO ATUAL", "FINALIDADE"];
const CAB_ALUGADOS = ["PLACA ", "MODELO", "COMBUT.", "ANO", "MARCA", "SECRETARIA ", "SITUAÇÃO ATUAL", "FINALIDADE", "LOCADORA"];

// Linhas reais da planilha (amostra de cada aba, com os problemas de digitação que ela tem).
const PLANILHA: AbaBruta[] = [
  {
    nome: "Próprios",
    linhas: [
      ["VEICULOS PROPRIOS"],
      CAB_PROPRIOS,
      ["HLF-2875", "UNO MILLE WAY ECON", "GASOLINA", "2010", "FIAT", "LEVE", "1120099", "ADMINISTRAÇÃO", "Ativo", "Atender as demandas da Segurança do Trabalho ", "PROPRIO"],
      ["SIZ-2D32", "FIAT ARGO", "FLEX", "2023/24", "FIAT", "LEVE", "1120321", "AGRICULTURA", "Em Manutenção", "Atende as demandas da secretaria", "PROPRIO"],
      ["4889", "MOTONIVELADORA PATROL RG170B", "DISEL S10", "2016", "NEW HOLAND", "PESADO", "1120211", "AGRICULTURA", "Ativo", "Realiza manutenções nas estradas rurais", "PROPRIO"],
      ["HLF 9820", "DUCATO MUL ATENA MI ", "DIESEL", "2012", "FIAT", "PESADO", "1120163", "ASSISTENCIA SOCIAL", "Inativo", "Esta parado,aguardando processo que esta em andamento contra prestador de serviços", "PROPRIO"],
      ["GYD-7019", "YBR", "GASOLINA", "2002", "YAMAHA", "LEVE", "1120170", "ADMINISTRAÇÃO", "Ativo", "Atender as demandas da secretaria ", "PROPRIO"],
      ["PROPRIO", "", "", "", "", "", "", "", "", "", ""],
      ["QOR - 2576", "Onix Joye", "Gasolina", "2018/2018", "Chevrolet", "LEVE", "1120240", "SAUDE / PSF", "Ativo", "Atender as demandas do PSF", "PROPRIO"],
      ["QQB - 9947", "Master", "Diesel", "2019/2019", "Renault", "PESADO", "1120246", "SAUDE / TFD", "Ativo", "Gestão de Risco", "PROPRIO"],
      ["HLF-0722", "GOL", "GASOLINA", "2010", "VOLKSWAGEN", "LEVE", "0000000", "SERVIÇOS URBANOS", "Inativo", "VEÍCULO AGUARDANDO ORÇAMENTO FINANCEIRO PARA MANUTENÇÃO.", "PROPRIO"],
      ["TGM-175", "TRATOR CORTADOR", "GASOLINA", "2023", "VONDER", "MÁQUINAS", "47372", "SERVIÇOS URBANOS", "Ativo", "VEÍCULO EM MANUTENÇÃO.", "PROPRIO"],
      ["-", "RETROESCAVADEIRA", "DIESEL", "2025", "XCMG", "PESADO", "50911", "SERVIÇOS URBANOS", "Ativo", "TRANSPORTE DE MATERIAIS", "PROPRIO"],
      ["R/LIPPEL PTU 300", "TRITURADOR", "DIESEL", "2022", "LIPPEL", "MÁQUINAS", "1120306", "SERVIÇOS URBANOS", "Ativo", " MAQUINÁRIO USADO PARA PICAR GALHOS", "PROPRIO"],
      ["Secretaria ", "Quantidade de Veículos"],
      ["Administração", "3"],
    ],
  },
  {
    nome: "Convênio",
    linhas: [
      ["VEICULOS DO CONVENIO"],
      CAB_CONVENIO,
      ["QXW-5F23", "Master 2.3 dCi Executive 16L Longo Dies", "DIESEL", "2023", "Renault", "PESADO", "ADMINISTRÇÃO", "CORPO DE BOMBEIRO", "ATIVO", "ATENDER AS DEMANDAS DO CORPO DE BOMBEIRO"],
      ["QOY-9073", "Ambulância", "Gasolina", "2019", "Peugeot", "LEVE", "GABINETE", "DEFESA CIVIL", "ATIVO", "ATENDER AS DEMANDAS DA DEFESA CIVIL"],
      ["QQB-9947", "Ambulância", "Diesel S10", "2019", "Renaut", "LEVE", "GABINETE", "DEFESA CIVIL", "ATIVO", "ATENDER AS DEMANDAS DA DEFESA CIVIL"],
      ["TYS-5C95", "Touro", "Gasolina/álcool", "", "Fiat", "LEVE", "GABINETE", "DEFESA CIVIL", "ATIVO", "ATENDER AS DEMANDAS DA DEFESA CIVIL"],
    ],
  },
  {
    nome: "Alugados",
    linhas: [
      ["VEICULOS ALUGADOS"],
      CAB_ALUGADOS,
      ["SGR-7C68", "GOL", "GASOLINA", "2022", "VOLKSWAGEN", "AGRICULTURA", "ATIVO", "PARA ATENDER AS DEMANDAS DA SECRETARIA ", "Star Locações de Serviços Gerais Ltda"],
      ["UIW-5E09", "POLO", "GASOLINA", "2025/2026", "VOLKSWAGEN", "CONSELHO TUTELAR", "ATIVO", "PARA ATENDER AS DEMANDAS DA SECRETARIA ", "Star Locações de Serviços Gerais Ltda"],
    ],
  },
];

describe("interpretarPlanilha", () => {
  const r = interpretarPlanilha(PLANILHA);
  const por = (placa: string, vinculo = "proprio") => r.veiculos.find((v) => v.placa === placa && v.vinculo === vinculo)!;

  it("reconhece as três abas pelas colunas e conta os veículos", () => {
    expect(r.abas).toEqual([
      { nome: "Próprios", vinculo: "proprio", lidos: 11 },
      { nome: "Convênio", vinculo: "convenio", lidos: 4 },
      { nome: "Alugados", vinculo: "alugado", lidos: 2 },
    ]);
    expect(r.veiculos).toHaveLength(17);
    expect(r.avisos).toEqual([]);
  });

  it("ignora a linha em branco e o quadro-resumo do pé da aba", () => {
    expect(r.veiculos.some((v) => v.modelo === "Quantidade de Veículos" || v.placa === "Administração")).toBe(false);
  });

  it("padroniza placa, combustível, ano, marca e classificação", () => {
    expect(por("QOR-2576")).toMatchObject({ combustivel: "gasolina", ano_fabricacao: 2018, secretaria: "Saúde", setor: "PSF" });
    expect(por("SIZ-2D32")).toMatchObject({ ano_fabricacao: 2023, ano_modelo: 2024, situacao: "em_manutencao", classificacao: "leve" });
    expect(por("4889")).toMatchObject({ combustivel: "diesel_s10", marca: "New Holland", classificacao: "pesado" });
    expect(por("HLF-9820")).toMatchObject({ situacao: "inativo", finalidade: null });
    expect(por("GYD-7019").classificacao).toBe("moto");
  });

  it("separa o motivo da parada da finalidade", () => {
    expect(por("HLF-0722")).toMatchObject({ situacao: "inativo", patrimonio: "0000000", finalidade: null });
    expect(por("HLF-0722").motivo_situacao).toMatch(/aguardando or/i);
    expect(por("TGM-175")).toMatchObject({ situacao: "em_manutencao", classificacao: "maquina" });
  });

  it("máquina sem placa fica sem placa e mantém o patrimônio", () => {
    const sem = r.veiculos.find((v) => v.patrimonio === "50911")!;
    expect(sem.placa).toBeNull();
    expect(por("R/LIPPEL PTU 300").classificacao).toBe("maquina");
  });

  it("convênio: setor vem da coluna e a placa repetida entre abas é mantida nas duas", () => {
    expect(por("QXW-5F23", "convenio")).toMatchObject({ secretaria: "Administração", setor: "Corpo de Bombeiros", patrimonio: null });
    expect(por("QOY-9073", "convenio")).toMatchObject({ secretaria: "Gabinete", setor: "Defesa Civil" });
    expect(r.veiculos.filter((v) => v.placa === "QQB-9947").map((v) => v.vinculo).sort()).toEqual(["convenio", "proprio"]);
    expect(por("TYS-5C95", "convenio")).toMatchObject({ ano_fabricacao: null, combustivel: "flex" });
  });

  it("alugados: locadora e Conselho Tutelar como setor do Gabinete", () => {
    expect(por("SGR-7C68", "alugado")).toMatchObject({ locadora: "Star Locações de Serviços Gerais Ltda", secretaria: "Agricultura" });
    expect(por("UIW-5E09", "alugado")).toMatchObject({ secretaria: "Gabinete", setor: "Conselho Tutelar", ano_fabricacao: 2025, ano_modelo: 2026 });
  });

  it("cada veículo tem uma chave diferente, mesmo com a placa repetida", () => {
    const chaves = new Set(r.veiculos.map(chaveVeiculo));
    expect(chaves.size).toBe(r.veiculos.length);
  });

  it("avisa de aba que não dá para interpretar", () => {
    const x = interpretarPlanilha([{ nome: "Notas", linhas: [["a", "b"], ["1", "2"]] }]);
    expect(x.veiculos).toEqual([]);
    expect(x.avisos[0]).toMatch(/PLACA/);
  });
});
