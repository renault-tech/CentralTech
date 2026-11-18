/**
 * Quando o objeto só nomeia o órgão ou a entidade ("A Secretaria Municipal de Esportes"), a finalidade costuma estar na
 * descrição da planilha ("Reforço da dotação orçamentária para a Secretaria…, cujo intuito será de aquisição de…").
 * Esta função monta um objeto descritivo a partir dela. Puro; devolve null se a descrição não traz a finalidade.
 */
export function objetoDaDescricao(descricao: string | null | undefined): string | null {
  const t = (descricao ?? "").replace(/\s+/g, " ").trim();
  const m = /^(Refor[çc]o da dota[çc][ãa]o or[çc]ament[áa]ria) (?:para|d[aeo]s?) (.+?),\s*(?:situad[ao][^,]*(?:,[^,]*){0,3},\s*)?(?:CNPJ[^,]*,\s*)?(?:situad[ao][^,]*(?:,[^,]*){0,3},\s*)?cujo (?:intuito|objetivo|finalidade) (?:ser[áa]|[ée]) (?:de |do |da |o |a )?(.+)$/i.exec(t);
  if (!m) return null;
  let fim = m[3];
  const corte = /,\s*(?:conforme|contribuindo|como forma|como condi|proporcionando|essenciais|importantes|de forma|fomentando|para (?:o|a|os|as) )|\.\s|\.$/i.exec(fim);
  if (corte) fim = fim.slice(0, corte.index);
  fim = fim.trim().replace(/[.,;]$/, "");
  if (fim.length < 8) return null;
  const de = /^(?:a|o)\s/i.test(m[2]) ? (/^a\s/i.test(m[2]) ? "da " : "do ") : "de ";
  const nome = m[2].replace(/^(?:a|o)\s+/i, "");
  return `${m[1].replace(" orçamentária", "")} ${de}${nome} para ${fim}`;
}
