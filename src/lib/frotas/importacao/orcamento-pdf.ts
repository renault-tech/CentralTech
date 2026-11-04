/**
 * Leitura de orçamentos de oficina a partir do TEXTO de um PDF (função pura). Os PDFs variam muito de
 * oficina para oficina, então isto só PROPÕE campos (placa, valor, data, oficina, serviço); a pessoa
 * confere tudo na prévia antes de gravar. O PDF em si nunca é guardado — só os dados confirmados.
 */

export type VeiculoBusca = { id: string; placa: string | null; modelo: string };
export type OficinaBusca = { id: string; nome: string };

export type OrcamentoLido = {
  veiculoId: string | null;
  placaLida: string | null;
  oficinaId: string | null;
  servico: string;
  valor: number | null;
  data: string | null;
  avisos: string[];
};

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const soAlfanumerico = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "1.234,56" → 1234.56 (null se não for número). */
export function lerDinheiro(txt: string): number | null {
  const n = txt.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(n)) return null;
  const v = Number(n);
  return v > 0 ? v : null;
}

function achaValor(texto: string): number | null {
  const linhas = texto.split(/\r?\n/);
  const re = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g;
  const doTotal: number[] = [];
  const todos: number[] = [];
  for (const linha of linhas) {
    const ehTotal = /total|valor\s+geral|a\s+pagar/i.test(semAcento(linha)) && !/sub\s*-?\s*total/i.test(semAcento(linha));
    for (const m of linha.matchAll(re)) {
      const v = lerDinheiro(m[1]);
      if (v === null) continue;
      todos.push(v);
      if (ehTotal) doTotal.push(v);
    }
  }
  if (doTotal.length) return doTotal[doTotal.length - 1];
  return todos.length ? Math.max(...todos) : null;
}

function achaData(texto: string, hoje: string): string | null {
  for (const m of texto.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) continue;
    if (iso > hoje) continue;
    return iso;
  }
  return null;
}

function achaServico(texto: string): string {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chave = /(servi[cç]o|descri[cç][aã]o|troca|revis[aã]o|conserto|reparo|substitui|retifica|alinhamento|freio|embreagem|suspens)/i;
  for (const l of linhas) {
    if (!chave.test(l) || /r\$|cnpj|cpf|telefone|endere/i.test(l) || l.length < 4) continue;
    return l.replace(/^(servi[cç]os?|descri[cç][aã]o)\s*[:\-]\s*/i, "").slice(0, 80);
  }
  return "";
}

export function lerOrcamentoDoTexto(texto: string, veiculos: VeiculoBusca[], oficinas: OficinaBusca[], hoje: string): OrcamentoLido {
  const avisos: string[] = [];
  const maiusculo = texto.toUpperCase();

  let veiculoId: string | null = null;
  let placaLida: string | null = null;
  const porPlaca = new Map(veiculos.filter((v) => v.placa).map((v) => [soAlfanumerico(v.placa as string), v.id]));
  for (const m of maiusculo.matchAll(/\b([A-Z]{3})[-\s]?(\d[A-Z0-9]\d{2})\b/g)) {
    const chave = m[1] + m[2];
    placaLida ??= `${m[1]}-${m[2]}`;
    const id = porPlaca.get(chave);
    if (id) {
      veiculoId = id;
      placaLida = `${m[1]}-${m[2]}`;
      break;
    }
  }
  if (!placaLida) avisos.push("Não achei a placa no documento.");
  else if (!veiculoId) avisos.push(`A placa ${placaLida} não está no cadastro de veículos.`);

  const normal = semAcento(texto);
  const oficina = oficinas.find((o) => o.nome.trim().length >= 4 && normal.includes(semAcento(o.nome.trim())));

  const valor = achaValor(texto);
  if (valor === null) avisos.push("Não achei o valor total.");
  const data = achaData(texto, hoje);
  const servico = achaServico(texto);
  if (!servico) avisos.push("Não identifiquei o serviço: digite na prévia.");

  return { veiculoId, placaLida, oficinaId: oficina?.id ?? null, servico, valor, data, avisos };
}
