import { bancoOficial, chaveDaConta } from "@/lib/emendas/conformidade";
import type { LinhaPortal } from "@/lib/emendas/portal-tipos";

/**
 * Verificação ANTES de publicar (e a cada atualização depois de publicado): olha exatamente
 * o que vai ao ar no portal e aponta o que pode expor a Prefeitura e os gestores.
 *  - crítico: dado errado ou sensível que não pode ir ao público sem decisão consciente
 *    (CPF em texto público, valores incoerentes, cota estourada, conta repetida, CNPJ inválido,
 *    emenda já executada sem a publicidade do art. 7º — § 2º manda divulgar ANTES);
 *  - atenção: item do art. 7º da IN TCE-MG 05/2025 (ou do § 1º do art. 2º da Recomendação
 *    MPC-MG 01/2025) que ainda não está informado;
 *  - informativo: o que o público vai ver e merece explicação (impedimentos, sem movimentação).
 * Puro: recebe as linhas do portal e os dados do exercício.
 */

export type Gravidade = "critico" | "atencao" | "info";

export type AlertaPortal = {
  id: string;
  gravidade: Gravidade;
  titulo: string;
  detalhe: string;
  base: string;
  /** Números das emendas afetadas (vazio = alerta do exercício todo). */
  emendas: number[];
  /** Onde corrigir, em linguagem de quem usa o módulo. */
  acao: string;
};

export type MetaVerificacao = {
  ano: number;
  cota: number;
  saudeMinPct: number;
  leiLoa: string | null;
  municipio: string | null;
  municipioCnpj: string | null;
  unidadeParlamentar: string | null;
  vereadoresSemPartido: string[];
};

const TOL = 0.005;
const vazio = (v: string | null | undefined) => !v || !v.trim();
const repasse = (l: LinhaPortal) => l.tipo !== "direta";
const executada = (l: LinhaPortal) => l.empenhado > TOL || l.pago > TOL;

/** CPF solto num texto (não parte de um CNPJ). */
const RE_CPF = /(?<![\d./-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d/-])/;
const RE_EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const RE_TELEFONE = /(?<!\d)\(?\d{2}\)?\s?9?\d{4}-\d{4}(?!\d)/;

export function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = base.split("").reduce((acc, c, i) => acc + Number(c) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/** Itens do art. 7º que faltam nesta emenda (só os que se aplicam ao tipo dela). */
export function itensFaltando(l: LinhaPortal): string[] {
  const f: string[] = [];
  if (vazio(l.localidade)) f.push("localidade (VI)");
  if (!l.inicioPrevisto && !l.terminoPrevisto && !l.vigenciaInicio && !l.vigenciaFim) f.push("cronograma (VII)");
  if (repasse(l) && vazio(l.termo)) f.push("termo/instrumento (VIII)");
  if (!repasse(l) && executada(l) && vazio(l.processo)) f.push("processo administrativo (VIII)");
  if (repasse(l) && !l.documentos.some((d) => d.tipo === "plano_trabalho")) f.push("plano de trabalho (IX)");
  if (repasse(l) && vazio(l.cnpj)) f.push("CNPJ do recebedor (XI)");
  if (vazio(l.gestorPrefeitura) && vazio(l.gestorEntidade)) f.push("gestor responsável (XIV)");
  if (repasse(l) && vazio(l.conta)) f.push("banco e conta (XVI)");
  if (l.saude && !l.anuenciaSus) f.push("anuência do SUS (XVII)");
  return f;
}

export function verificarPortal(linhas: LinhaPortal[], meta: MetaVerificacao, hoje: string = new Date().toISOString().slice(0, 10)): AlertaPortal[] {
  const out: AlertaPortal[] = [];
  const add = (a: AlertaPortal) => {
    if (a.emendas.length > 0 || a.id.startsWith("ex:")) out.push({ ...a, emendas: [...new Set(a.emendas)].sort((x, y) => x - y) });
  };
  const onde = (fn: (l: LinhaPortal) => boolean) => linhas.filter(fn).map((l) => l.numero);

  // ——— Críticos ———
  const textosPublicos = (l: LinhaPortal) => [l.objeto, l.descricao, l.localidade, l.beneficiario, l.gestorPrefeitura, l.gestorEntidade, l.planoMetas, l.termo, l.processo, l.contrato].filter(Boolean).join(" \n ");
  add({
    id: "lgpd_cpf",
    gravidade: "critico",
    titulo: "Possível CPF em texto que vai ao público",
    detalhe: "O objeto, a descrição, o beneficiário, o gestor ou outro campo público contém um número no formato de CPF. CPF é dado pessoal e não deve ser divulgado.",
    base: "Lei 13.709/2018 (LGPD), arts. 6º e 7º; Lei 12.527/2011, art. 31",
    emendas: onde((l) => RE_CPF.test(textosPublicos(l))),
    acao: "Abra a emenda e retire o número do texto (Dados da emenda ou Transparência).",
  });
  add({
    id: "lgpd_contato",
    gravidade: "atencao",
    titulo: "E-mail ou telefone em texto público",
    detalhe: "Há e-mail ou telefone no objeto, na descrição ou em outro campo público. Se for de pessoa física, retire.",
    base: "Lei 13.709/2018 (LGPD), art. 6º, III (necessidade)",
    emendas: onde((l) => RE_EMAIL.test(textosPublicos(l)) || RE_TELEFONE.test(textosPublicos(l))),
    acao: "Revise o texto da emenda.",
  });
  add({
    id: "empenho_maior_valor",
    gravidade: "critico",
    titulo: "Empenhado maior que o valor da emenda",
    detalhe: "O portal mostraria mais dinheiro empenhado do que a emenda autoriza.",
    base: "Lei 4.320/1964, art. 59; LRF, art. 48-A",
    emendas: onde((l) => l.empenhado > l.valor + TOL),
    acao: "Confira os empenhos na aba Financeiro da emenda.",
  });
  add({
    id: "pago_maior_empenho",
    gravidade: "critico",
    titulo: "Pago maior que o empenhado",
    detalhe: "Não há pagamento sem empenho prévio; o público veria um número impossível.",
    base: "Lei 4.320/1964, arts. 60 e 62",
    emendas: onde((l) => l.pago > l.empenhado + TOL),
    acao: "Lance o empenho que falta ou corrija o pagamento na aba Financeiro.",
  });
  add({
    id: "pagamento_futuro",
    gravidade: "critico",
    titulo: "Pagamento com data no futuro",
    detalhe: "Há movimentação financeira com data posterior a hoje.",
    base: "Lei 4.320/1964, art. 64",
    emendas: onde((l) => l.movimentos.some((m) => !!m.data && m.data > hoje)),
    acao: "Corrija a data do lançamento na aba Financeiro.",
  });
  add({
    id: "cnpj_invalido",
    gravidade: "critico",
    titulo: "CNPJ do recebedor inválido",
    detalhe: "O número informado não passa na conferência dos dígitos verificadores; o público veria um CNPJ inexistente.",
    base: "IN TCE-MG 05/2025, art. 7º, XI",
    emendas: onde((l) => !vazio(l.cnpj) && !cnpjValido(l.cnpj as string)),
    acao: "Corrija o CNPJ no cadastro do beneficiário.",
  });
  {
    const porConta = new Map<string, number[]>();
    for (const l of linhas) {
      const k = chaveDaConta(l.conta);
      if (k) porConta.set(k, [...(porConta.get(k) ?? []), l.numero]);
    }
    add({
      id: "conta_repetida",
      gravidade: "critico",
      titulo: "A mesma conta bancária em mais de uma emenda",
      detalhe: "A IN exige conta específica para cada transferência e veda contas de passagem. O portal mostraria a mesma conta em emendas diferentes.",
      base: "IN TCE-MG 05/2025, art. 6º; Recomendação MPC-MG 01/2025, art. 2º, VI",
      emendas: [...porConta.values()].filter((v) => v.length > 1).flat(),
      acao: "Confirme com a entidade a conta de cada emenda (aba Transparência) ou registre a justificativa jurídica.",
    });
  }
  {
    const somas = new Map<string, { total: number; nums: number[] }>();
    for (const l of linhas) {
      const s = somas.get(l.vereador) ?? { total: 0, nums: [] };
      somas.set(l.vereador, { total: s.total + l.valor, nums: [...s.nums, l.numero] });
    }
    const acima = [...somas.entries()].filter(([, s]) => s.total > meta.cota + TOL);
    add({
      id: "cota_excedida",
      gravidade: "critico",
      titulo: "Soma de um vereador acima da cota",
      detalhe: acima.map(([v]) => v).join(", ") + ` — cota de ${meta.cota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por vereador.`,
      base: "CF, art. 166, § 9º (ADIs 6670 e 7493); IN TCE-MG 05/2025, art. 8º, X",
      emendas: acima.flatMap(([, s]) => s.nums),
      acao: "Revise os valores das emendas do vereador ou a cota do exercício.",
    });
  }
  add({
    id: "executada_sem_publicidade",
    gravidade: "critico",
    titulo: "Emenda já executada sem a publicidade completa",
    detalhe:
      "Estas emendas já têm empenho ou pagamento, mas ainda faltam itens do art. 7º. O § 2º manda divulgar antes da execução, e o art. 8º, XI, prevê suspensão. O portal mostra a lacuna como \"não informado\".",
    base: "IN TCE-MG 05/2025, art. 7º, § 2º, e art. 8º, XI; Recomendação MPC-MG 01/2025, art. 4º, § 1º",
    emendas: onde((l) => executada(l) && itensFaltando(l).length > 0),
    acao: "Complete o bloco Transparência de cada emenda (veja o detalhe nos alertas de atenção abaixo).",
  });

  // ——— Exercício (vale para todas) ———
  if (vazio(meta.leiLoa))
    add({ id: "ex:loa", gravidade: "atencao", titulo: "Número da LOA não informado", detalhe: "Cada emenda deve aparecer ligada à lei que a aprovou.", base: "IN TCE-MG 05/2025, art. 7º, II", emendas: [], acao: "Configurações › Exercício." });
  if (vazio(meta.municipio) || vazio(meta.municipioCnpj))
    add({ id: "ex:municipio", gravidade: "atencao", titulo: "Município e CNPJ do Município não informados", detalhe: "Exigidos como recebedor dos recursos (e recebedor na execução direta).", base: "IN TCE-MG 05/2025, art. 7º, XII; Recomendação MPC-MG 01/2025, art. 2º, § 1º, IV", emendas: [], acao: "Configurações › Exercício › Dados de publicação." });
  else if (!cnpjValido(meta.municipioCnpj as string))
    add({ id: "ex:municipio_cnpj", gravidade: "critico", titulo: "CNPJ do Município inválido", detalhe: "Aparece em todas as emendas de execução direta.", base: "IN TCE-MG 05/2025, art. 7º, XII", emendas: [], acao: "Configurações › Exercício › Dados de publicação." });
  if (vazio(meta.unidadeParlamentar))
    add({ id: "ex:unidade", gravidade: "atencao", titulo: "Unidade parlamentar não informada", detalhe: "Ex.: \"Câmara Municipal de Cataguases\".", base: "IN TCE-MG 05/2025, art. 7º, I", emendas: [], acao: "Configurações › Exercício › Dados de publicação." });
  {
    const nomes = new Set(linhas.map((l) => l.vereador));
    const sem = meta.vereadoresSemPartido.filter((v) => nomes.has(v));
    if (sem.length)
      add({ id: "ex:partido", gravidade: "atencao", titulo: `Partido não informado (${sem.length} vereador${sem.length > 1 ? "es" : ""})`, detalhe: sem.join(", "), base: "IN TCE-MG 05/2025, art. 7º, I", emendas: onde((l) => sem.includes(l.vereador)), acao: "Vereadores › editar cada vereador." });
  }
  {
    const total = linhas.reduce((s, l) => s + l.valor, 0);
    const saude = linhas.filter((l) => l.saude).reduce((s, l) => s + l.valor, 0);
    const cotaTotal = meta.cota * new Set(linhas.map((l) => l.vereador)).size;
    if (total > 0 && saude < (cotaTotal * meta.saudeMinPct) / 100 - TOL)
      add({
        id: "ex:saude",
        gravidade: "atencao",
        titulo: "Destinação à saúde abaixo do mínimo",
        detalhe: `${((saude / (cotaTotal || 1)) * 100).toFixed(1).replace(".", ",")}% das cotas vão para a saúde; o mínimo é ${String(meta.saudeMinPct).replace(".", ",")}%. O portal exibe esse percentual.`,
        base: "CF, art. 166, § 9º; IN TCE-MG 05/2025, art. 8º, X",
        emendas: [],
        acao: "Confira a marcação \"Saúde\" das emendas.",
      });
  }

  // ——— Atenção: itens do art. 7º por emenda ———
  const item = (id: string, titulo: string, base: string, fn: (l: LinhaPortal) => boolean, acao: string, detalhe = "O portal mostra \"não informado\" neste item.") =>
    add({ id, gravidade: "atencao", titulo, detalhe, base, emendas: onde(fn), acao });
  item("localidade", "Localidade beneficiada não informada", "IN TCE-MG 05/2025, art. 7º, VI", (l) => vazio(l.localidade), "Emenda › Transparência › Localidade.");
  item("cronograma", "Cronograma (início e término) não informado", "IN TCE-MG 05/2025, art. 7º, VII", (l) => !l.inicioPrevisto && !l.terminoPrevisto && !l.vigenciaInicio && !l.vigenciaFim, "Emenda › Transparência › Cronograma.");
  item("termo", "Repasse sem número do termo", "IN TCE-MG 05/2025, art. 7º, VIII; Lei 13.019/2014, art. 42", (l) => repasse(l) && executada(l) && vazio(l.termo), "Emenda › Parceria › Termo.");
  item("processo", "Execução direta empenhada sem processo administrativo", "IN TCE-MG 05/2025, art. 7º, VIII", (l) => !repasse(l) && executada(l) && vazio(l.processo), "Emenda › vincular o processo do Compras.");
  item("plano", "Repasse sem plano de trabalho publicado", "IN TCE-MG 05/2025, art. 7º, IX; Recomendação MPC-MG 01/2025, art. 2º, IV", (l) => repasse(l) && !l.documentos.some((d) => d.tipo === "plano_trabalho"), "Emenda › Anexos › Plano de trabalho (PDF).");
  item("cnpj", "Repasse sem CNPJ do recebedor", "IN TCE-MG 05/2025, art. 7º, XI", (l) => repasse(l) && vazio(l.cnpj), "Configurações › Beneficiários.");
  item("gestor", "Gestor responsável não informado", "IN TCE-MG 05/2025, art. 7º, XIV", (l) => vazio(l.gestorPrefeitura) && vazio(l.gestorEntidade), "Emenda › Parceria/Transparência › Gestor.");
  item("conta", "Repasse sem banco e conta", "IN TCE-MG 05/2025, art. 7º, XVI, e art. 6º", (l) => repasse(l) && vazio(l.conta), "Emenda › Parceria › Conta bancária.");
  item("conta_oficial", "Conta fora de banco oficial", "IN TCE-MG 05/2025, art. 6º (\"onde houver\")", (l) => bancoOficial(l.conta) === false, "Confirme com o jurídico se há agência de banco oficial no município.", "A IN pede instituição financeira oficial onde houver (Banco do Brasil, Caixa).");
  item("sus", "Emenda de saúde sem anuência do SUS informada", "IN TCE-MG 05/2025, art. 7º, XVII; Recomendação MPC-MG 01/2025, art. 2º, § 3º", (l) => l.saude && !l.anuenciaSus, "Emenda › Transparência › Anuência do SUS.");
  item("identificador", "Sem identificador contábil da emenda", "IN TCE-MG 05/2025, arts. 4º e 5º; Recomendação MPC-MG 01/2025, art. 2º, IX", (l) => executada(l) && vazio(l.identificadorContabil), "Emenda › Transparência › Identificador contábil (com a Contabilidade).", "Não aparece como \"não informado\" no portal, mas é exigido para a rastreabilidade.");
  item("pagamento_sem_data", "Pagamento sem data", "IN TCE-MG 05/2025, art. 7º, XIII", (l) => l.movimentos.some((m) => m.tipo === "pagamento" && !m.data) || (l.pago > TOL && !l.ultimoPagamento), "Emenda › Financeiro › data do pagamento.");
  item("extrato", "Termo sem extrato publicado", "Lei 13.019/2014, art. 38", (l) => repasse(l) && !vazio(l.termo) && !l.extratoPublicadoEm, "Emenda › Parceria › Extrato publicado em.", "A parceria só produz efeitos depois da publicação do extrato.");
  item("vigencia", "Vigência do termo encerrada com valor a pagar", "Lei 13.019/2014, arts. 55 e 69", (l) => repasse(l) && !!l.vigenciaFim && l.vigenciaFim < hoje && l.pago < l.valor - TOL && l.situacao !== "impedida", "Emenda › Parceria: prorrogue a vigência ou registre o encerramento.", "O público veria parceria vencida com recurso ainda não pago.");
  item("objeto", "Objeto pouco descritivo", "IN TCE-MG 05/2025, art. 7º, III", (l) => l.objeto.trim().length < 15 || /^(diversos|aquisi[cç][aã]o|manuten[cç][aã]o|apoio)\.?$/i.test(l.objeto.trim()), "Emenda › Dados: descreva a ação e a finalidade.");

  // ——— Relatório de gestão (§ 1º): 30/06 do ano seguinte ao primeiro pagamento ———
  {
    const vencidos: number[] = [];
    const proximos: number[] = [];
    for (const l of linhas) {
      const anos = l.movimentos.filter((m) => m.tipo === "pagamento" && m.data).map((m) => Number(m.data!.slice(0, 4)));
      if (!anos.length) continue;
      const prazo = `${Math.min(...anos) + 1}-06-30`;
      const entregue = l.documentos.some((d) => d.tipo === "relatorio_gestao");
      if (entregue) continue;
      if (hoje > prazo) vencidos.push(l.numero);
      else if ((Date.parse(prazo) - Date.parse(hoje)) / 86_400_000 <= 60) proximos.push(l.numero);
    }
    add({ id: "relatorio_vencido", gravidade: "critico", titulo: "Relatório de gestão vencido", detalhe: "Prazo: 30 de junho do ano seguinte ao recebimento dos recursos.", base: "IN TCE-MG 05/2025, art. 7º, X e § 1º", emendas: vencidos, acao: "Emenda › Anexos › Relatório de gestão." });
    add({ id: "relatorio_proximo", gravidade: "atencao", titulo: "Relatório de gestão vence em até 60 dias", detalhe: "Prazo: 30 de junho.", base: "IN TCE-MG 05/2025, art. 7º, § 1º", emendas: proximos, acao: "Emenda › Anexos › Relatório de gestão." });
  }

  // ——— Informativos ———
  add({ id: "impedidas", gravidade: "info", titulo: "Emendas com impedimento aparecem como \"Com impedimento\"", detalhe: "O público vê o tipo de impedimento (técnico, legal ou de documentação), sem o texto interno.", base: "CF, art. 166, § 13", emendas: onde((l) => l.situacao === "impedida"), acao: "Nada a fazer, se o impedimento está correto." });
  add({ id: "sem_movimento", gravidade: "info", titulo: "Emendas ainda sem nenhuma movimentação", detalhe: "Aparecem como \"Aguardando empenho\".", base: "LRF, art. 48-A", emendas: onde((l) => !executada(l) && l.situacao !== "impedida"), acao: "Nada a fazer; confirme se a fase está atualizada." });

  const peso: Record<Gravidade, number> = { critico: 0, atencao: 1, info: 2 };
  return out.sort((a, b) => peso[a.gravidade] - peso[b.gravidade] || b.emendas.length - a.emendas.length);
}

export function contarPorGravidade(alertas: AlertaPortal[]): Record<Gravidade, number> {
  const r = { critico: 0, atencao: 0, info: 0 };
  for (const a of alertas) r[a.gravidade] += 1;
  return r;
}
