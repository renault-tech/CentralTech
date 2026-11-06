/**
 * Leitura (pura) das planilhas de CONTROLE de água (COPASA) e luz (Energisa): uma aba por secretaria, vários blocos por aba (cada um com
 * "Proj. Atividade", uma linha de cabeçalho `CDC|Matrícula · Setor · Endereço · Jan … Dez` e uma linha por unidade consumidora).
 * Só interpreta; quem grava é a action, depois da prévia e da confirmação. Testada em `planilha-contas.test.ts` com o mesmo desenho
 * das planilhas reais (inclusive o segundo código sem cabeçalho da Energisa, as parcelas de dívida da COPASA e as abas auxiliares).
 */

export type Celula = string | number | null | undefined;
export type AbaBruta = { nome: string; linhas: Celula[][] };

export type LinhaPlanilha = {
  aba: string;
  /** Linha da planilha (1 = primeira), para o aviso apontar onde está. */
  linhaNumero: number;
  /** Texto do "Proj. Atividade" do bloco (dotação), só para a pessoa se situar. */
  projeto: string | null;
  codigo: string;
  /** Segundo código da Energisa (coluna sem cabeçalho, ao lado do CDC). */
  codigo2: string | null;
  setor: string;
  endereco: string;
  /** Jan…Dez; null = célula vazia. */
  valores: (number | null)[];
  /** Motivo para NÃO importar (ex.: parcela de dívida); a pessoa pode ver, não entra. */
  ignorada: string | null;
};

export type AbaLida = { nome: string; linhas: LinhaPlanilha[]; blocos: number; semValores: number };
export type ResultadoPlanilhaContas = { abas: AbaLida[]; avisos: string[] };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
/** Minúsculas, sem acento, sem pontuação e sem espaços repetidos. */
export function chave(s: string): string {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const texto = (c: Celula): string => (c === null || c === undefined ? "" : String(c).trim());

/** 12.5 → 12.5; "1.234,56" → 1234.56; "1234.56" → 1234.56; vazio/ilegível → null. */
export function numeroDaCelula(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = texto(c).replace(/R\$|\s/g, "");
  if (!s) return null;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : null;
}

const DIVIDA = /valor juros|valor amort|amortiza|^juros|divida/;

type Cabecalho = { linha: number; codigo: number; segundoCodigo: number | null; setor: number; endereco: number; meses: number[] };

/** Procura as colunas na linha de cabeçalho (a que tem "Jan"). */
function lerCabecalho(linhas: Celula[][], i: number): Cabecalho | null {
  const row = linhas[i] ?? [];
  const jan = row.findIndex((c) => chave(texto(c)) === "jan");
  if (jan < 0) return null;
  const meses: number[] = [];
  for (let k = 0; k < 12; k++) {
    const idx = row.findIndex((c, col) => col >= jan && chave(texto(c)) === MESES[k]);
    if (idx < 0) return null;
    meses.push(idx);
  }
  const achar = (re: RegExp) => row.findIndex((c) => re.test(chave(texto(c))));
  const codigo = achar(/^(cdc|matricula)$/);
  const setor = achar(/^setor$/);
  const endereco = achar(/^endereco$/);
  if (codigo < 0 || setor < 0 || endereco < 0) return null;
  // Energisa: a coluna entre o CDC e o Setor não tem cabeçalho e guarda um segundo código.
  const segundoCodigo = setor - codigo === 2 ? codigo + 1 : null;
  return { linha: i, codigo, segundoCodigo, setor, endereco, meses };
}

function tituloDoBloco(linhas: Celula[][], deLinha: number): string | null {
  for (let i = deLinha - 1; i >= Math.max(0, deLinha - 3); i--) {
    const row = linhas[i] ?? [];
    // Linha do título: tem "Proj. Atividade" ou "Consumo …" (em algumas abas o rótulo "Proj. Atividade" não existe).
    if (!row.some((c) => /^(proj|consumo|media)/.test(chave(texto(c))))) continue;
    const t = row.map(texto).find((x) => x && !/^(proj|consumo|media)/.test(chave(x)));
    if (t) return t;
  }
  return null;
}

export function lerPlanilhaContas(abas: AbaBruta[]): ResultadoPlanilhaContas {
  const out: AbaLida[] = [];
  const avisos: string[] = [];
  for (const aba of abas) {
    const cab: Cabecalho[] = [];
    aba.linhas.forEach((_, i) => {
      const c = lerCabecalho(aba.linhas, i);
      if (c) cab.push(c);
    });
    if (cab.length === 0) {
      avisos.push(`Aba “${aba.nome.trim()}” ignorada: não tem cabeçalho com Código/Setor/Endereço e os meses.`);
      continue;
    }
    const linhas: LinhaPlanilha[] = [];
    let semValores = 0;
    cab.forEach((c, bi) => {
      const fim = bi + 1 < cab.length ? cab[bi + 1].linha : aba.linhas.length;
      const projeto = tituloDoBloco(aba.linhas, c.linha);
      for (let i = c.linha + 1; i < fim; i++) {
        const row = aba.linhas[i] ?? [];
        // Chegou no título do próximo bloco ("Proj. Atividade"): para.
        if (row.some((x) => chave(texto(x)).startsWith("proj"))) break;
        const codigo = texto(row[c.codigo]).replace(/\s+/g, "");
        if (!codigo) continue;
        const valores = c.meses.map((col) => numeroDaCelula(row[col]));
        // Linha sem nenhum mês preenchido (ex.: FICHA/EMPENHO no meio da aba): não é conta, não entra.
        if (valores.every((v) => v === null)) {
          semValores++;
          continue;
        }
        const setor = texto(row[c.setor]).replace(/\s+/g, " ");
        const motivo = DIVIDA.test(chave(setor)) ? "Parcela de dívida (juros ou amortização), não é conta de consumo." : null;
        linhas.push({
          aba: aba.nome.trim(),
          linhaNumero: i + 1,
          projeto,
          codigo,
          codigo2: c.segundoCodigo !== null ? texto(row[c.segundoCodigo]).replace(/\s+/g, "") || null : null,
          setor: setor || "(sem nome)",
          endereco: texto(row[c.endereco]).replace(/\s+/g, " "),
          valores,
          ignorada: motivo,
        });
      }
    });
    out.push({ nome: aba.nome.trim(), linhas, blocos: cab.length, semValores });
  }
  return { abas: out, avisos };
}

// ------------------------------------------------------------------ secretaria da aba

const REGRAS_ABA: [RegExp, string][] = [
  [/administra/, "administracao"],
  [/(ass|des).*social|assist/, "assistencia social"],
  [/serv.*urb/, "servicos urbanos"],
  [/educa/, "educacao"],
  [/esporte/, "esporte"],
  [/saude/, "saude"],
  [/gabinete/, "gabinete do prefeito"],
  [/fazenda/, "fazenda"],
  [/agricultura/, "agricultura"], // antes de "cultura": "agricultura" contém "cultura"
  [/^cultura/, "cultura"],
  [/obras/, "obras"],
];

/** A secretaria do catálogo que o nome da aba indica (ou null: a pessoa escolhe na prévia). */
export function secretariaDaAba(nomeAba: string, catalogo: { id: string; nome: string }[]): string | null {
  const k = chave(nomeAba);
  const alvo = REGRAS_ABA.find(([re]) => re.test(k))?.[1] ?? k;
  return catalogo.find((s) => chave(s.nome) === alvo)?.id ?? null;
}

/** Chave de comparação de código de unidade (sem espaços nem maiúsculas). */
export const chaveCodigo = (c: string) => c.replace(/\s+/g, "").toLowerCase();

/** Endereço "genérico" não serve para casar imóveis (ex.: "Rua Principal S/N" se repete em vários distritos). */
export function enderecoEspecifico(e: string): boolean {
  const k = chave(e);
  return k.length >= 12 && /\d/.test(k) && !/^(rua|estrada|praca|avenida|av|r) (principal|s n|sn)\b/.test(k);
}

export const MESES_ROTULO = MESES;
