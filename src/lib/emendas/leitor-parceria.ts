/**
 * Lê o TEXTO de um PDF de termo/extrato e PROPÕE o nº do termo e a data de publicação. Conservador de propósito: só devolve
 * um valor quando ele é inequívoco (um único candidato); na dúvida devolve nada e o cadastro segue manual. Puro, sem rede.
 */

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export type LeituraParceria = { numeroTermo: string | null; dataPublicacao: string | null };

function semAcento(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function iso(d: number, m: number, a: number): string | null {
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const x = new Date(Date.UTC(a, m - 1, d));
  if (x.getUTCMonth() !== m - 1) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Datas ("30 de agosto de 2026" ou "30/08/2026") que aparecem perto de palavras de publicação (edição, jornal, publicado). */
export function datasDePublicacao(texto: string): string[] {
  const t = semAcento(texto).replace(/\s+/g, " ");
  const achadas = new Set<string>();
  const padroes = [
    /(\d{1,2}) de ([a-z]+) de (\d{4})/g,
    /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/g,
  ];
  for (const [i, re] of padroes.entries()) {
    for (const m of t.matchAll(re)) {
      const dia = Number(m[1]);
      const mes = i === 0 ? MESES[m[2]] : Number(m[2]);
      const data = mes ? iso(dia, mes, Number(m[3])) : null;
      if (!data) continue;
      const pos = m.index ?? 0;
      const contexto = t.slice(Math.max(0, pos - 60), pos + m[0].length + 20);
      if (/(edicao|jornal|publicad|publicacao|diario)/.test(contexto)) achadas.add(data);
    }
  }
  return [...achadas];
}

export function numeroDoTermo(texto: string): string | null {
  const t = semAcento(texto).replace(/\s+/g, " ");
  const achados = new Set<string>();
  for (const m of t.matchAll(/(?:termo|convenio|contrato de rateio)[^\d]{0,50}?n[o°º]?\.?\s*(\d{1,3})\s*\/\s*(20\d{2})/g)) achados.add(`${m[1].padStart(3, "0")}/${m[2]}`);
  return achados.size === 1 ? [...achados][0] : null;
}

export function lerParceria(texto: string): LeituraParceria {
  const datas = datasDePublicacao(texto);
  return { numeroTermo: numeroDoTermo(texto), dataPublicacao: datas.length === 1 ? datas[0] : null };
}
