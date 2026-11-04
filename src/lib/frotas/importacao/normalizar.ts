/**
 * Padronização dos campos da planilha de veículos. A planilha foi digitada à
 * mão: a mesma placa aparece como "QOR - 2576" e "HLF 9820", o diesel como
 * "DISEL S10" e "Diesel S10", a Saúde como "SAUDE / PSF" e "SAÚDE - TFD".
 * Funções puras, testadas em `importacao.test.ts`.
 */

import type { Classificacao, Combustivel, SituacaoVeiculo } from "@/types/frotas";

/** Minúsculo, sem acento, só letras e números — chave de comparação. */
export function chaveTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function limpar(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function tituloCase(valor: string): string {
  return limpar(valor)
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ------------------------------------------------------------- placa

/** Padrão antigo (ABC-1234) e Mercosul (ABC-1D23), sempre com hífen. Máquinas ficam com o número de frota que a planilha traz. */
export function normalizarPlaca(valor: unknown): string | null {
  const bruto = limpar(valor).toUpperCase();
  if (!bruto || /^[-–.\s]+$/.test(bruto)) return null;
  const m = bruto.match(/^([A-Z]{3})[\s-]*(\d[A-Z0-9]\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : bruto;
}

// ------------------------------------------------------------- combustível, ano, classificação

export function normalizarCombustivel(valor: unknown): Combustivel | null {
  const k = chaveTexto(limpar(valor));
  if (!k) return null;
  if (k.includes("diesel") || k.includes("disel")) return k.includes("s10") ? "diesel_s10" : "diesel";
  if (k.includes("flex") || (k.includes("gasolina") && (k.includes("alcool") || k.includes("etanol")))) return "flex";
  if (k.includes("gasolina")) return "gasolina";
  return null;
}

/** "2023/24" → fabricação 2023, modelo 2024; "2018" → os dois. */
export function normalizarAnos(valor: unknown): { fabricacao: number | null; modelo: number | null } {
  const m = limpar(valor).match(/(\d{4})(?:\s*\/\s*(\d{2,4}))?/);
  if (!m) return { fabricacao: null, modelo: null };
  const fabricacao = Number(m[1]);
  let modelo = fabricacao;
  if (m[2]) modelo = m[2].length === 2 ? Math.floor(fabricacao / 100) * 100 + Number(m[2]) : Number(m[2]);
  if (fabricacao < 1900 || fabricacao > 2100 || modelo < 1900 || modelo > 2100) return { fabricacao: null, modelo: null };
  return { fabricacao, modelo };
}

const PALAVRAS_MOTO = /\b(motocicleta|moto|cg|ybr|bros|fan|xtz|biz|pop)\b/i;

export function normalizarClassificacao(valor: unknown, modelo: string, marca: string | null): Classificacao | null {
  if (PALAVRAS_MOTO.test(modelo) || (marca && /honda|yamaha|shineray/i.test(marca) && /\b(cg|ybr|bros|fan|xtz)\b/i.test(modelo))) return "moto";
  const k = chaveTexto(limpar(valor));
  if (k.startsWith("leve")) return "leve";
  if (k.startsWith("pesad")) return "pesado";
  if (k.startsWith("maquin")) return "maquina";
  return null;
}

// ------------------------------------------------------------- marca

const MARCAS: Record<string, string> = {
  volkswagen: "Volkswagen",
  volksvagen: "Volkswagen",
  fiat: "Fiat",
  fiativeco: "Iveco",
  iveco: "Iveco",
  renault: "Renault",
  renaut: "Renault",
  chevrolet: "Chevrolet",
  gm: "Chevrolet",
  gmchevrolet: "Chevrolet",
  honda: "Honda",
  yamaha: "Yamaha",
  toyota: "Toyota",
  peugeot: "Peugeot",
  citroen: "Citroën",
  mercedes: "Mercedes-Benz",
  mercedesbenz: "Mercedes-Benz",
  newholland: "New Holland",
  newholand: "New Holland",
  newhollandb90: "New Holland",
  ford: "Ford",
  marcopolo: "Marcopolo",
  xcmg: "XCMG",
  ls: "LS",
  valmet: "Valmet",
  lippel: "Lippel",
  vonder: "Vonder",
  volvo: "Volvo",
  shineray: "Shineray",
  mitsubishi: "Mitsubishi",
  jeep: "Jeep",
  engecart: "Engecart",
  michigam: "Michigan",
  michigan: "Michigan",
};

export function normalizarMarca(valor: unknown): string | null {
  const bruto = limpar(valor);
  if (!bruto) return null;
  return MARCAS[chaveTexto(bruto)] ?? tituloCase(bruto);
}

// ------------------------------------------------------------- patrimônio

export function normalizarPatrimonio(valor: unknown): string | null {
  const bruto = limpar(valor).replace(/\.0+$/, "");
  return bruto || null;
}

// ------------------------------------------------------------- secretaria e setor

const SECRETARIAS: Record<string, string> = {
  administracao: "Administração",
  administrcao: "Administração",
  agricultura: "Agricultura",
  assistenciasocial: "Assistência Social",
  cultura: "Cultura",
  educacao: "Educação",
  esporte: "Esporte",
  fazenda: "Fazenda",
  gabinete: "Gabinete",
  saude: "Saúde",
  servicosurbanos: "Serviços Urbanos",
  catrans: "Catrans",
  obras: "Obras",
};

const SETORES: Record<string, string> = {
  policiamilitar: "Polícia Militar",
  policiacivil: "Polícia Civil",
  corpodebombeiro: "Corpo de Bombeiros",
  corpodebombeiros: "Corpo de Bombeiros",
  defesacivil: "Defesa Civil",
  policlinica: "Policlínica",
  vigilancia: "Vigilância",
  endemias: "Endemias",
  conselhotutelar: "Conselho Tutelar",
};

function normalizarSetor(valor: string): string | null {
  const bruto = limpar(valor);
  if (!bruto) return null;
  const conhecido = SETORES[chaveTexto(bruto)];
  if (conhecido) return conhecido;
  // Siglas curtas ficam em maiúsculas (PSF, TFD, CAPS AD).
  return bruto
    .split(" ")
    .map((p) => (/^[A-Za-zÀ-ÿ]{1,4}$/.test(p) && p === p.toUpperCase() ? p : tituloCase(p)))
    .join(" ");
}

export type SecretariaESetor = { secretaria: string; setor: string | null; nova: boolean };

/**
 * "SAUDE / PSF" → Saúde + PSF; "CONSELHO TUTELAR" → Gabinete + Conselho Tutelar;
 * o setor da coluna própria (convênio) vale mais que o deduzido do nome.
 */
export function normalizarSecretaria(valor: unknown, setorColuna?: unknown): SecretariaESetor {
  const bruto = limpar(valor);
  const [principal, ...resto] = bruto.split(/\s*[\/–]\s*|\s+-\s+/);
  const chave = chaveTexto(principal ?? "");
  let setor = normalizarSetor(limpar(setorColuna)) ?? normalizarSetor(resto.join(" / "));

  if (chave === "conselhotutelar") return { secretaria: "Gabinete", setor: setor ?? "Conselho Tutelar", nova: false };

  const conhecida = SECRETARIAS[chave];
  if (conhecida) return { secretaria: conhecida, setor, nova: false };

  // Secretaria que o catálogo não conhece: mantém o que veio e avisa.
  setor = setor ?? null;
  return { secretaria: tituloCase(principal ?? bruto) || "Sem secretaria", setor, nova: true };
}

// ------------------------------------------------------------- situação

const FINALIDADE_QUE_E_SITUACAO = /aguardando|em manuten|parado|\bbaixa\b|leil[aã]o/i;

/**
 * A coluna "finalidade" da planilha mistura o uso do veículo com o motivo de ele
 * estar parado ("aguardando leilão"). Aqui os dois são separados: o motivo vai
 * para `motivo_situacao`, e "em manutenção" num veículo ativo muda a situação.
 */
export function interpretarSituacao(
  situacaoBruta: unknown,
  finalidadeBruta: unknown
): { situacao: SituacaoVeiculo; motivo: string | null; finalidade: string | null } {
  const k = chaveTexto(limpar(situacaoBruta));
  let situacao: SituacaoVeiculo = k.startsWith("inativ") ? "inativo" : k.includes("manuten") ? "em_manutencao" : "ativo";
  const finalidade = limpar(finalidadeBruta).replace(/\s+\.$/, ".");
  if (finalidade && FINALIDADE_QUE_E_SITUACAO.test(finalidade)) {
    if (situacao === "ativo" && /em manuten/i.test(finalidade)) situacao = "em_manutencao";
    return { situacao, motivo: finalidade.slice(0, 300), finalidade: null };
  }
  return { situacao, motivo: null, finalidade: finalidade || null };
}
