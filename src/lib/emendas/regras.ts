/**
 * Regras do módulo Emendas — funções puras (sem servidor), usadas pelas
 * telas e testadas em `regras.test.ts`. As mesmas regras valem no banco
 * (triggers/CHECKs em supabase/migrations/20261021000000_emendas_schema.sql);
 * aqui elas só antecipam o aviso na tela e calculam os painéis.
 */

import type { EmendaResumo, EtapaEmenda, Modalidade, PerfilEfetivo } from "@/types/emendas";

export const COR_MODULO = "#6B4FBB";

export type InfoEtapa = {
  chave: EtapaEmenda;
  nome: string;
  /** Rampa sequencial (mais escuro = mais adiante). Fundo, nunca texto. */
  cor: string;
  /** 0 sem andamento · 1 em andamento · 2 empenhada/liquidada · 3 paga ou adiante */
  grupo: 0 | 1 | 2 | 3;
  /** Fase fixa: só renomeia/recolore, não sai do fluxo. */
  fixa?: boolean;
};

/** Uma fase dentro do fluxo de uma modalidade (a ordem é a do array). */
export type ItemFluxo = { chave: EtapaEmenda; ativa: boolean };

/** Fases (nome, cor, grupo) + o fluxo de cada modalidade. Vem do banco
 * (`emendas.etapas` / `emendas.fluxo_etapas`, editável em Configurações →
 * Fases); `CATALOGO_PADRAO` é o ponto de partida e o reserva. */
export type CatalogoEtapas = {
  etapas: Record<string, InfoEtapa>;
  fluxos: Record<Modalidade, ItemFluxo[]>;
};

/** Fases que nunca saem do fluxo; ficam nesta ordem, "Indicada" primeiro e "Concluída" por último. */
export const ETAPAS_FIXAS: EtapaEmenda[] = ["indicada", "empenhada", "liquidada", "paga", "concluida"];

export const ETAPAS: InfoEtapa[] = [
  { chave: "indicada", nome: "Indicada", cor: "#CBD5E1", grupo: 0, fixa: true },
  { chave: "analise", nome: "Análise técnica", cor: "#DDD6F7", grupo: 1 },
  { chave: "plano_trabalho", nome: "Plano de trabalho", cor: "#BBAAEE", grupo: 1 },
  { chave: "processo_compra", nome: "Processo de compra", cor: "#BBAAEE", grupo: 1 },
  { chave: "termo_parceria", nome: "Termo de parceria", cor: "#C9B8F0", grupo: 1 },
  { chave: "empenhada", nome: "Empenhada", cor: "#9479DD", grupo: 2, fixa: true },
  { chave: "liquidada", nome: "Liquidada", cor: "#7556C7", grupo: 2, fixa: true },
  { chave: "envio_pagamento", nome: "Enviada para pagamento", cor: "#6849B5", grupo: 2 },
  { chave: "paga", nome: "Paga", cor: "#563A9E", grupo: 3, fixa: true },
  { chave: "prestacao_contas", nome: "Prestação de contas", cor: "#43307E", grupo: 3 },
  { chave: "concluida", nome: "Concluída", cor: "#2A1C55", grupo: 3, fixa: true },
];

const itens = (chaves: string[]): ItemFluxo[] => chaves.map((chave) => ({ chave, ativa: true }));

export const CATALOGO_PADRAO: CatalogoEtapas = {
  etapas: Object.fromEntries(ETAPAS.map((e) => [e.chave, e])),
  fluxos: {
    repasse: itens([
      "indicada", "analise", "plano_trabalho", "termo_parceria", "empenhada", "liquidada", "envio_pagamento", "paga",
      "prestacao_contas", "concluida",
    ]),
    direta: itens(["indicada", "analise", "processo_compra", "empenhada", "liquidada", "envio_pagamento", "paga", "concluida"]),
  },
};

export function infoEtapa(chave: string, cat: CatalogoEtapas = CATALOGO_PADRAO): InfoEtapa {
  return cat.etapas[chave] ?? { chave, nome: chave, cor: "#CBD5E1", grupo: 0 };
}

export const GRUPOS_EXECUCAO = [
  { grupo: 3, nome: "Paga ou adiante", cor: "#563A9E" },
  { grupo: 2, nome: "Empenhada / liquidada", cor: "#9479DD" },
  { grupo: 1, nome: "Em andamento", cor: "#DDD6F7" },
  { grupo: 0, nome: "Sem andamento", cor: "#CBD5E1" },
] as const;

/** Trilha de fases ATIVAS da modalidade, na ordem do fluxo. */
export function trilha(modalidade: Modalidade, cat: CatalogoEtapas = CATALOGO_PADRAO): EtapaEmenda[] {
  return cat.fluxos[modalidade].filter((i) => i.ativa).map((i) => i.chave);
}

/** Posição da fase atual na trilha ATIVA. Se a fase foi desativada depois
 * (a emenda ficou nela), vale a posição da última fase ativa antes dela. */
export function posicaoNaTrilha(modalidade: Modalidade, etapa: EtapaEmenda, cat: CatalogoEtapas = CATALOGO_PADRAO): number {
  const completo = cat.fluxos[modalidade];
  const i = completo.findIndex((x) => x.chave === etapa);
  if (i < 0) return -1;
  return completo.slice(0, i + 1).filter((x) => x.ativa).length - 1;
}

/** Etapas que podem vir a seguir (registrar um andamento). Inclui a
 * trilha inteira à frente — pular fase é permitido (a planilha só sabia
 * "executada"). Se a fase atual foi desativada depois, a trilha ativa inteira
 * (menos "Indicada") continua disponível. */
export function proximasEtapas(modalidade: Modalidade, atual: EtapaEmenda, cat: CatalogoEtapas = CATALOGO_PADRAO): EtapaEmenda[] {
  const completo = cat.fluxos[modalidade];
  const i = completo.findIndex((x) => x.chave === atual);
  return completo.filter((x, idx) => x.ativa && idx > i).map((x) => x.chave);
}

/** Todas as fases dos dois fluxos numa lista só (funil, filtros): junta as
 * ordens preservando a sequência de cada fluxo. Fases desativadas só entram
 * se houver emenda nelas (`usadas`). */
export function etapasEmOrdem(cat: CatalogoEtapas, usadas?: Set<string>): InfoEtapa[] {
  const ordem: string[] = [];
  const colocar = (fluxo: ItemFluxo[]) => {
    let ancora = -1;
    for (const item of fluxo) {
      const existente = ordem.indexOf(item.chave);
      if (existente >= 0) {
        ancora = existente;
      } else {
        ordem.splice(ancora + 1, 0, item.chave);
        ancora += 1;
      }
    }
  };
  colocar(cat.fluxos.repasse);
  colocar(cat.fluxos.direta);
  const ativas = new Set([...cat.fluxos.repasse, ...cat.fluxos.direta].filter((i) => i.ativa).map((i) => i.chave));
  return ordem
    .filter((c) => ativas.has(c) || usadas?.has(c))
    .map((c) => infoEtapa(c, cat));
}

export type ItemEdicaoFluxo = { chave: string | null; nome: string; ativa: boolean; remover?: boolean };

/** Mesmas regras de `emendas.salvar_fluxo` (o banco é quem decide; aqui só
 * antecipa o aviso na tela). Devolve a mensagem do primeiro problema. */
export function validarFluxo(itensFluxo: ItemEdicaoFluxo[]): string | null {
  const restantes = itensFluxo.filter((i) => !i.remover);
  if (!restantes.length) return "Informe ao menos uma fase.";
  if (restantes.some((i) => i.nome.trim().length < 2 || i.nome.trim().length > 60)) {
    return "O nome de cada fase precisa ter de 2 a 60 caracteres.";
  }
  if (itensFluxo.some((i) => i.remover && i.chave && ETAPAS_FIXAS.includes(i.chave))) {
    return "Fases fixas (Indicada, Empenhada, Liquidada, Paga e Concluída) não podem ser removidas.";
  }
  if (restantes.some((i) => i.chave && ETAPAS_FIXAS.includes(i.chave) && !i.ativa)) {
    return "Fases fixas não podem ser desativadas.";
  }
  const nomes = restantes.filter((i) => i.ativa).map((i) => i.nome.trim().toLowerCase());
  if (new Set(nomes).size !== nomes.length) return "Há duas fases ativas com o mesmo nome.";
  const chaves = restantes.map((i) => i.chave);
  let ultima = -1;
  for (const f of ETAPAS_FIXAS) {
    const pos = chaves.indexOf(f);
    if (pos < 0) return "As fases fixas precisam continuar no fluxo.";
    if (pos <= ultima) return "As fases fixas precisam seguir a ordem: Indicada, Empenhada, Liquidada, Paga, Concluída.";
    ultima = pos;
  }
  if (chaves[0] !== "indicada") return "A primeira fase precisa ser “Indicada”.";
  if (chaves[chaves.length - 1] !== "concluida") return "A última fase precisa ser “Concluída”.";
  return null;
}

/** 3º grupo da natureza de despesa: 50 = transferência a entidade privada
 * sem fins lucrativos; 90/91/93 = aplicação direta. Espelha
 * `emendas.modalidade_por_natureza`. */
export function modalidadePorNatureza(natureza: string | null | undefined): Modalidade | null {
  const grupo = (natureza ?? "").split(".")[2];
  if (grupo === "50") return "repasse";
  if (grupo === "90" || grupo === "91" || grupo === "93") return "direta";
  return null;
}

export const NOME_MODALIDADE: Record<Modalidade, string> = {
  repasse: "Repasse a entidade",
  direta: "Aplicação direta",
};

export const NOME_PERFIL: Record<PerfilEfetivo, string> = {
  admin: "Admin da plataforma",
  gestor: "Gestor de emendas",
  admin_secretaria: "Admin de secretaria",
  operador: "Operador",
  consulta: "Consulta",
};

export const DESCRICAO_PERFIL: Record<PerfilEfetivo, string> = {
  admin: "Acesso total, inclusive configurar o módulo e as permissões de todos.",
  gestor: "Vê e edita todas as secretarias, inclusive valor, vereador, dotação e remanejamentos.",
  admin_secretaria:
    "Registra a execução da própria secretaria. Ver as outras secretarias é opcional. As permissões são definidas pelo administrador ou pelo gestor.",
  operador: "Registra andamentos, empenhos, pagamentos e documentos nas secretarias liberadas.",
  consulta: "Só visualiza as secretarias liberadas: painel, lista, detalhes e relatórios.",
};

export function ehGestor(perfil: PerfilEfetivo | null | undefined): boolean {
  return perfil === "admin" || perfil === "gestor";
}

// ------------------------------------------------------------- formatação

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(v: number): string {
  return BRL.format(v);
}

/** "R$ 5,16 mi" / "R$ 425 mil" — para KPIs e rótulos de barra. */
export function brlCurto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) {
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  }
  if (abs >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return brl(v);
}

export function pct(x: number, casas = 1): string {
  const v = Number.isFinite(x) ? x * 100 : 0;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
}

/** "2026-03-26" → "26/03/2026" (sem fuso: data pura). */
/** Situação da vigência do termo/cronograma em relação a `hoje` (AAAA-MM-DD). */
export function situacaoVigencia(
  fim: string | null | undefined,
  hoje: string
): { texto: string; alerta: boolean } | null {
  if (!fim) return null;
  const dias = Math.round((Date.parse(fim.slice(0, 10)) - Date.parse(hoje)) / 86_400_000);
  if (dias < 0) return { texto: `Vigência encerrada em ${dataBr(fim)} — acompanhar a prestação de contas`, alerta: true };
  if (dias === 0) return { texto: "Vigência termina hoje", alerta: true };
  if (dias <= 30) return { texto: `Vigência termina em ${dias} dia${dias === 1 ? "" : "s"}`, alerta: true };
  return { texto: `Em vigência até ${dataBr(fim)}`, alerta: false };
}

export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function numeroVereador(n: number): string {
  return String(n).padStart(2, "0");
}

// ------------------------------------------------------------- agregações

const soma = (rs: { valor: number }[]) => rs.reduce((t, r) => t + r.valor, 0);
const somaCampo = (rs: EmendaResumo[], campo: "pago" | "empenhado" | "liquidado") =>
  rs.reduce((t, r) => t + Number(r[campo] ?? 0), 0);

export type Indicadores = {
  total: number;
  quantidade: number;
  empenhado: number;
  pago: number;
  aExecutar: number;
  saude: number;
  quantidadePagas: number;
  remanejadas: number;
  impedidas: number;
};

export function indicadores(rs: EmendaResumo[], cat: CatalogoEtapas = CATALOGO_PADRAO): Indicadores {
  const total = soma(rs);
  const pago = somaCampo(rs, "pago");
  return {
    total,
    quantidade: rs.length,
    empenhado: somaCampo(rs, "empenhado"),
    pago,
    aExecutar: total - pago,
    saude: soma(rs.filter((r) => r.saude)),
    quantidadePagas: rs.filter((r) => infoEtapa(r.etapa, cat).grupo === 3).length,
    remanejadas: rs.filter((r) => r.remanejada).length,
    impedidas: rs.filter((r) => r.situacao === "impedida").length,
  };
}

export type PorGrupo = [number, number, number, number];

/** Valor por grupo de execução (índice = `InfoEtapa.grupo`). */
export function valorPorGrupo(rs: EmendaResumo[], cat: CatalogoEtapas = CATALOGO_PADRAO): PorGrupo {
  const g: PorGrupo = [0, 0, 0, 0];
  for (const r of rs) g[infoEtapa(r.etapa, cat).grupo] += r.valor;
  return g;
}

export type LinhaVereador = {
  vereadorId: string;
  numero: number;
  nome: string;
  total: number;
  saude: number;
  pago: number;
  quantidade: number;
  grupos: PorGrupo;
};

export function porVereador(
  rs: EmendaResumo[],
  vereadores: { id: string; numero: number; nome: string }[],
  cat: CatalogoEtapas = CATALOGO_PADRAO
): LinhaVereador[] {
  return vereadores
    .slice()
    .sort((a, b) => a.numero - b.numero)
    .map((v) => {
      const dele = rs.filter((r) => r.vereador_id === v.id);
      return {
        vereadorId: v.id,
        numero: v.numero,
        nome: v.nome,
        total: soma(dele),
        saude: soma(dele.filter((r) => r.saude)),
        pago: somaCampo(dele, "pago"),
        quantidade: dele.length,
        grupos: valorPorGrupo(dele, cat),
      };
    });
}

export type LinhaSecretaria = { secretariaId: string; nome: string; total: number; pago: number; quantidade: number };

export function porSecretaria(rs: EmendaResumo[]): LinhaSecretaria[] {
  const mapa = new Map<string, LinhaSecretaria>();
  for (const r of rs) {
    const atual = mapa.get(r.secretaria_id) ?? {
      secretariaId: r.secretaria_id,
      nome: r.secretaria_nome,
      total: 0,
      pago: 0,
      quantidade: 0,
    };
    atual.total += r.valor;
    atual.pago += Number(r.pago ?? 0);
    atual.quantidade += 1;
    mapa.set(r.secretaria_id, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

export function porEtapa(
  rs: EmendaResumo[],
  cat: CatalogoEtapas = CATALOGO_PADRAO
): { etapa: InfoEtapa; quantidade: number; valor: number }[] {
  const usadas = new Set(rs.map((r) => r.etapa));
  return etapasEmOrdem(cat, usadas).map((etapa) => {
    const daEtapa = rs.filter((r) => r.etapa === etapa.chave);
    return { etapa, quantidade: daEtapa.length, valor: soma(daEtapa) };
  });
}

/** Pago acumulado mês a mês (1..12) a partir dos pagamentos com data. */
export function curvaPagamentos(
  pagamentos: { data: string | null; valor: number }[],
  ano: number
): { acumulado: number[]; semData: number } {
  const porMes = new Array(13).fill(0) as number[];
  let semData = 0;
  for (const p of pagamentos) {
    if (!p.data) {
      semData += p.valor;
      continue;
    }
    const [a, m] = p.data.split("-").map(Number);
    if (a !== ano) continue;
    porMes[m] += p.valor;
  }
  const acumulado: number[] = [];
  let ac = 0;
  for (let m = 1; m <= 12; m++) {
    ac += porMes[m];
    acumulado.push(ac);
  }
  return { acumulado, semData };
}

/** Parcela na Saúde de um vereador, sobre a COTA (regra constitucional:
 * metade do total das emendas individuais vai para ações e serviços
 * públicos de saúde). */
export function cumpreSaude(saude: number, cota: number, minimoPct: number): boolean {
  return saude + 0.005 >= cota * (minimoPct / 100);
}

export type Alerta = {
  chave: string;
  nivel: "atencao" | "info" | "ok";
  quantidade: number;
  titulo: string;
  detalhe: string;
  /** Números das emendas envolvidas (para filtrar a lista). */
  numeros: number[];
};

export function diasAteFimDoAno(hoje: Date, ano: number): number {
  const fim = Date.UTC(ano, 11, 31);
  const h = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((fim - h) / 86400000));
}

export function alertas(
  rs: EmendaResumo[],
  movimentos: { emenda_id: string; tipo: string; numero: string | null; data: string | null }[],
  opcoes: { hoje: Date; ano: number; diasParado: number; catalogo?: CatalogoEtapas }
): Alerta[] {
  const cat = opcoes.catalogo ?? CATALOGO_PADRAO;
  const lista = (ns: number[]) => ns.slice(0, 6).map((n) => `nº ${n}`).join(", ") + (ns.length > 6 ? "…" : "");
  const porId = new Map(rs.map((r) => [r.id, r]));
  const lista_ = (arr: EmendaResumo[]) => arr.map((r) => r.numero).sort((a, b) => a - b);
  const out: Alerta[] = [];

  const semAndamento = rs.filter((r) => r.etapa === "indicada" && r.situacao !== "cancelada");
  const dias = diasAteFimDoAno(opcoes.hoje, opcoes.ano);
  out.push({
    chave: "sem_andamento",
    nivel: semAndamento.length ? "atencao" : "ok",
    quantidade: semAndamento.length,
    titulo: "Sem nenhum andamento registrado",
    detalhe: semAndamento.length
      ? `${brlCurto(soma(semAndamento))} indicados sem análise técnica nem empenho. Faltam ${dias} dias para o fim do exercício.`
      : "Todas as emendas já têm andamento.",
    numeros: lista_(semAndamento),
  });

  const limite = opcoes.hoje.getTime() - opcoes.diasParado * 86400000;
  const paradas = rs.filter(
    (r) =>
      r.situacao === "normal" &&
      r.etapa !== "indicada" &&
      infoEtapa(r.etapa, cat).grupo < 3 &&
      new Date(r.etapa_atualizada_em).getTime() < limite
  );
  out.push({
    chave: "paradas",
    nivel: paradas.length ? "atencao" : "ok",
    quantidade: paradas.length,
    titulo: `Paradas há mais de ${opcoes.diasParado} dias`,
    detalhe: paradas.length ? `${lista(lista_(paradas))}: sem mudança de etapa desde então.` : "Nenhuma emenda em andamento está parada.",
    numeros: lista_(paradas),
  });

  const impedidas = rs.filter((r) => r.situacao === "impedida");
  out.push({
    chave: "impedidas",
    nivel: impedidas.length ? "atencao" : "ok",
    quantidade: impedidas.length,
    titulo: "Impedidas aguardando remanejamento",
    detalhe: impedidas.length ? `${lista(lista_(impedidas))}: decidir o remanejamento.` : "Nenhum impedimento em aberto.",
    numeros: lista_(impedidas),
  });

  const pagas = rs.filter((r) => infoEtapa(r.etapa, cat).grupo === 3);
  const empenhosPorEmenda = new Map<string, { numero: string | null; data: string | null }[]>();
  const pagamentosPorEmenda = new Map<string, { data: string | null }[]>();
  for (const m of movimentos) {
    if (m.tipo === "empenho") empenhosPorEmenda.set(m.emenda_id, [...(empenhosPorEmenda.get(m.emenda_id) ?? []), m]);
    if (m.tipo === "pagamento") pagamentosPorEmenda.set(m.emenda_id, [...(pagamentosPorEmenda.get(m.emenda_id) ?? []), m]);
  }
  const semEmpenho = pagas.filter((r) => !(empenhosPorEmenda.get(r.id) ?? []).some((e) => e.numero));
  out.push({
    chave: "sem_empenho",
    nivel: semEmpenho.length ? "atencao" : "ok",
    quantidade: semEmpenho.length,
    titulo: "Pagas sem nº de empenho",
    detalhe: semEmpenho.length ? `${lista(lista_(semEmpenho))}: completar o número do empenho.` : "Nada pendente.",
    numeros: lista_(semEmpenho),
  });

  const semDataPagamento = pagas.filter((r) => (pagamentosPorEmenda.get(r.id) ?? []).some((p) => !p.data));
  out.push({
    chave: "sem_data_pagamento",
    nivel: semDataPagamento.length ? "atencao" : "ok",
    quantidade: semDataPagamento.length,
    titulo: "Pagas sem data de pagamento",
    detalhe: semDataPagamento.length
      ? `${lista(lista_(semDataPagamento))}: informar a data do pagamento.`
      : "Nada pendente.",
    numeros: lista_(semDataPagamento),
  });

  const porNumeroEmpenho = new Map<string, Set<string>>();
  for (const m of movimentos) {
    if (m.tipo !== "empenho" || !m.numero || !porId.has(m.emenda_id)) continue;
    porNumeroEmpenho.set(m.numero, (porNumeroEmpenho.get(m.numero) ?? new Set()).add(m.emenda_id));
  }
  const repetidos = Array.from(porNumeroEmpenho.entries()).filter(([, ids]) => ids.size > 1);
  out.push({
    chave: "empenho_repetido",
    nivel: repetidos.length ? "atencao" : "ok",
    quantidade: repetidos.length,
    titulo: "Nº de empenho repetido",
    detalhe: repetidos.length
      ? repetidos
          .map(([n, ids]) => `EMP ${n} (${Array.from(ids).map((id) => `nº ${porId.get(id)?.numero}`).join(" e ")})`)
          .join("; ") + ". Confirmar se é o mesmo empenho."
      : "Nada pendente.",
    numeros: repetidos.flatMap(([, ids]) => Array.from(ids).map((id) => porId.get(id)?.numero ?? 0)),
  });

  const remanejadas = rs.filter((r) => r.remanejada);
  out.push({
    chave: "remanejadas",
    nivel: "info",
    quantidade: remanejadas.length,
    titulo: "Remanejamentos no histórico",
    detalhe: "Alterações de destinação ou dotação, com antes e depois guardados em cada emenda.",
    numeros: lista_(remanejadas),
  });

  return out;
}
