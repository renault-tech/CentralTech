"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dataNoFuso } from "@/lib/fuso";
import { obterContextoFrotas } from "@/lib/frotas/dados";
import { normalizarPlaca } from "@/lib/frotas/importacao/normalizar";
import { avisosNota, quinzenaDe } from "@/lib/frotas/regras";
import type { CodigoRevisao } from "@/lib/frotas/revisao";
import { criarClienteFrotas } from "@/lib/supabase/frotas-cliente";

/**
 * Ações do módulo Frotas. A permissão de verdade está no banco (RLS do schema
 * `frotas`: só gestor escreve) e as regras de integridade também (CHECKs de
 * ordem das datas e da cadeia da manutenção, índices únicos) — aqui só valida o
 * formato, traduz o erro e devolve avisos que não bloqueiam. Nenhuma ação usa
 * service_role.
 */

export type Resultado = { sucesso: true; id?: string; aviso?: string } | { sucesso: false; erro: string };

type ErroBanco = { message?: string; code?: string } | null | undefined;

const MENSAGENS_DO_BANCO: [RegExp, string][] = [
  [/nf_numero_unico/i, "Já existe uma NF com este número para esta secretaria e este posto."],
  [/nf_periodo_ok/i, "A quinzena da NF está inválida."],
  [/nf_ordem_datas/i, "As datas da NF estão fora de ordem: emissão, envio à secretaria, retorno e envio à Contabilidade."],
  [/man_oc_unica/i, "Esta OC já está registrada em outra manutenção."],
  [/man_oc_exige_liberacao/i, "A OC só pode ser registrada depois de liberar o serviço."],
  [/man_nf_completa/i, "Informe número, data de emissão e valor da NF juntos."],
  [/man_cadeia/i, "Siga a ordem: OC, envio da OC, NF, retorno dos documentos e Contabilidade. Uma etapa não pode ser preenchida antes da anterior."],
  [/man_ordem_datas/i, "Há uma data anterior à da etapa que vem antes dela."],
  [/man_analise_datada/i, "A decisão sobre o orçamento precisa de data de análise."],
  [/veiculo_alugado_tem_locadora/i, "Veículo alugado precisa da locadora."],
  [/veiculo_valor_e_fonte/i, "Valor de referência e a sua origem precisam andar juntos."],
  [/parametros_dias_ordem/i, "O prazo de “atenção” não pode ser maior que o “crítico”."],
  [/parametros_pct_ordem/i, "O percentual de “atenção” não pode ser maior que o “crítico”."],
  [/secretarias_nome_unico/i, "Já existe uma secretaria com este nome."],
  [/fornecedores_unico/i, "Já existe um fornecedor deste tipo com este nome."],
  [/foreign key/i, "Este registro está em uso por outros e não pode ser removido."],
];

function traduzir(erro: ErroBanco): string {
  const m = erro?.message ?? "";
  if (erro?.code === "42501" || /row-level security/i.test(m)) return "Sem permissão para alterar os dados de Frotas.";
  for (const [padrao, texto] of MENSAGENS_DO_BANCO) if (padrao.test(m)) return texto;
  return "Não foi possível concluir a ação. Tente novamente.";
}

async function exigirGestor() {
  const ctx = await obterContextoFrotas();
  return ctx.situacao === "ok" && ctx.gestor ? ctx : null;
}

function atualizarTelas() {
  revalidatePath("/frotas", "layout");
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const dataOpcional = data.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No máximo ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const dinheiro = z.number({ error: "Informe o valor" }).positive("O valor deve ser maior que zero").max(99_999_999_999);
const ano = z.number().int().min(1900).max(2100).nullable().optional().transform((v) => v ?? null);

const falha = (erro: string): Resultado => ({ sucesso: false, erro });
const invalido = (e: z.ZodError): Resultado => falha(e.issues[0]?.message ?? "Dados inválidos");

// ------------------------------------------------------------- veículos

const esquemaVeiculo = z.object({
  id: z.uuid().optional(),
  placa: texto(20),
  modelo: z.string().trim().min(1, "Informe o modelo").max(160),
  marca: texto(80),
  anoFabricacao: ano,
  anoModelo: ano,
  combustivel: z.enum(["gasolina", "flex", "diesel", "diesel_s10"]).nullable().optional().transform((v) => v ?? null),
  classificacao: z.enum(["leve", "pesado", "maquina", "moto"]).nullable().optional().transform((v) => v ?? null),
  patrimonio: texto(30),
  vinculo: z.enum(["proprio", "convenio", "alugado"]),
  secretariaId: z.uuid("Escolha a secretaria"),
  setor: texto(120),
  situacao: z.enum(["ativo", "em_manutencao", "inativo", "baixado"]),
  motivoSituacao: texto(300),
  finalidade: texto(500),
  locadoraId: z.uuid().nullable().optional().transform((v) => v ?? null),
  /** `undefined` = não mexe no valor de referência; `null` = apaga; número = valor digitado. */
  valorManual: z.number().min(0).max(99_999_999_999).nullable().optional(),
  observacoes: texto(2000),
});

export async function salvarVeiculo(dados: z.input<typeof esquemaVeiculo>): Promise<Resultado> {
  const a = esquemaVeiculo.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera veículos.");
  const v = a.data;
  if (v.vinculo === "alugado" && !v.locadoraId) return falha("Veículo alugado precisa da locadora.");

  const linha = {
    placa: normalizarPlaca(v.placa),
    modelo: v.modelo,
    marca: v.marca,
    ano_fabricacao: v.anoFabricacao,
    ano_modelo: v.anoModelo,
    combustivel: v.combustivel,
    classificacao: v.classificacao,
    patrimonio: v.patrimonio,
    vinculo: v.vinculo,
    secretaria_id: v.secretariaId,
    setor: v.setor,
    situacao: v.situacao,
    motivo_situacao: v.motivoSituacao,
    finalidade: v.finalidade,
    locadora_id: v.vinculo === "alugado" ? v.locadoraId : null,
    observacoes: v.observacoes,
    ...(v.valorManual === undefined
      ? {}
      : v.valorManual === null
        ? { valor_referencia: null, valor_fonte: null, valor_referencia_em: null }
        : { valor_referencia: v.valorManual, valor_fonte: "manual" as const, valor_referencia_em: dataNoFuso(new Date()) }),
  };

  const frotas = await criarClienteFrotas();
  if (v.id) {
    const { error } = await frotas.from("veiculos").update(linha).eq("id", v.id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id: v.id };
  }
  const { data: criado, error } = await frotas.from("veiculos").insert({ ...linha, origem: "Cadastro manual" }).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criado.id };
}

const CODIGOS_REVISAO: CodigoRevisao[] = [
  "placa_repetida",
  "patrimonio_repetido",
  "patrimonio_zerado",
  "patrimonio_fora_padrao",
  "sem_placa",
  "sem_ano",
  "sem_combustivel",
];

/** "Está correto": o aviso de revisão some para este veículo. */
export async function marcarRevisaoCorreta(veiculoId: string, codigo: string): Promise<Resultado> {
  if (!z.uuid().safeParse(veiculoId).success || !CODIGOS_REVISAO.includes(codigo as CodigoRevisao)) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera veículos.");
  const frotas = await criarClienteFrotas();
  const { data: atual, error: erroLeitura } = await frotas.from("veiculos").select("revisao_ignorada").eq("id", veiculoId).single();
  if (erroLeitura) return falha(traduzir(erroLeitura));
  const novos = Array.from(new Set([...(atual.revisao_ignorada ?? []), codigo]));
  const { error } = await frotas.from("veiculos").update({ revisao_ignorada: novos }).eq("id", veiculoId);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: veiculoId };
}

export async function excluirVeiculo(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera veículos.");
  const frotas = await criarClienteFrotas();
  const { error } = await frotas.from("veiculos").delete().eq("id", id);
  if (error) {
    if (/foreign key/i.test(error.message ?? "")) {
      return falha("Este veículo tem manutenções registradas e não pode ser excluído. Mude a situação para “Baixado”.");
    }
    return falha(traduzir(error));
  }
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- NF de combustível

const esquemaNota = z.object({
  id: z.uuid().optional(),
  secretariaId: z.uuid("Escolha a secretaria"),
  fornecedorId: z.uuid().nullable().optional().transform((v) => v ?? null),
  numeroNf: z.string().trim().min(1, "Informe o número da NF").max(40),
  /** Qualquer data da quinzena a que a NF se refere. */
  quinzena: data,
  dataEmissao: data,
  valor: dinheiro,
  enviadaSecretariaEm: dataOpcional,
  retornouEm: dataOpcional,
  enviadaContabilidadeEm: dataOpcional,
  observacoes: texto(2000),
});

export async function salvarNota(dados: z.input<typeof esquemaNota>): Promise<Resultado> {
  const a = esquemaNota.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera notas fiscais.");
  const n = a.data;
  const q = quinzenaDe(n.quinzena);
  const linha = {
    secretaria_id: n.secretariaId,
    fornecedor_id: n.fornecedorId,
    numero_nf: n.numeroNf,
    periodo_inicio: q.inicio,
    periodo_fim: q.fim,
    data_emissao: n.dataEmissao,
    valor: n.valor,
    enviada_secretaria_em: n.enviadaSecretariaEm,
    retornou_em: n.retornouEm,
    enviada_contabilidade_em: n.enviadaContabilidadeEm,
    observacoes: n.observacoes,
  };

  const frotas = await criarClienteFrotas();
  let id = n.id;
  if (id) {
    const { error } = await frotas.from("notas_combustivel").update(linha).eq("id", id);
    if (error) return falha(traduzir(error));
  } else {
    const { data: criada, error } = await frotas.from("notas_combustivel").insert(linha).select("id").single();
    if (error) return falha(traduzir(error));
    id = criada.id;
  }
  atualizarTelas();
  const avisos = avisosNota({
    data_emissao: linha.data_emissao,
    enviada_secretaria_em: linha.enviada_secretaria_em,
    retornou_em: linha.retornou_em,
    enviada_contabilidade_em: linha.enviada_contabilidade_em,
    periodo_inicio: linha.periodo_inicio,
    periodo_fim: linha.periodo_fim,
  });
  return { sucesso: true, id, aviso: avisos[0] };
}

export async function excluirNota(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera notas fiscais.");
  const frotas = await criarClienteFrotas();
  const { error } = await frotas.from("notas_combustivel").delete().eq("id", id);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- manutenção

const esquemaManutencao = z.object({
  id: z.uuid().optional(),
  veiculoId: z.uuid("Escolha o veículo"),
  fornecedorId: z.uuid().nullable().optional().transform((v) => v ?? null),
  servico: z.string().trim().min(2, "Informe o serviço (ex.: troca de embreagem)").max(80),
  descricao: texto(1000),
  orcamentoValor: dinheiro,
  orcamentoRecebidoEm: data,
  observacoes: texto(2000),
});

/** Registra o orçamento da secretaria (ou o corrige, enquanto ainda não foi decidido). */
export async function salvarManutencao(dados: z.input<typeof esquemaManutencao>): Promise<Resultado> {
  const a = esquemaManutencao.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera manutenções.");
  const m = a.data;
  const frotas = await criarClienteFrotas();

  if (!m.id) {
    const { data: veiculo, error: erroVeiculo } = await frotas.from("veiculos").select("secretaria_id").eq("id", m.veiculoId).single();
    if (erroVeiculo) return falha("Veículo não encontrado.");
    const { data: criada, error } = await frotas
      .from("manutencoes")
      .insert({
        veiculo_id: m.veiculoId,
        secretaria_id: veiculo.secretaria_id,
        fornecedor_id: m.fornecedorId,
        servico: m.servico,
        descricao: m.descricao,
        orcamento_valor: m.orcamentoValor,
        orcamento_recebido_em: m.orcamentoRecebidoEm,
        observacoes: m.observacoes,
      })
      .select("id")
      .single();
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id: criada.id };
  }

  const { data: atual, error: erroLeitura } = await frotas.from("manutencoes").select("status_analise").eq("id", m.id).single();
  if (erroLeitura) return falha("Manutenção não encontrada.");
  const aberta = atual.status_analise === "a_analisar" || atual.status_analise === "novo_orcamento";
  const comuns = { fornecedor_id: m.fornecedorId, servico: m.servico, descricao: m.descricao, observacoes: m.observacoes };
  const { error } = await frotas
    .from("manutencoes")
    .update(
      aberta
        ? // Um novo orçamento recebido reabre a análise.
          { ...comuns, orcamento_valor: m.orcamentoValor, orcamento_recebido_em: m.orcamentoRecebidoEm, status_analise: "a_analisar", analisado_em: null }
        : comuns
    )
    .eq("id", m.id);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return {
    sucesso: true,
    id: m.id,
    aviso: aberta ? undefined : "O orçamento já foi decidido: só o serviço, a descrição, a oficina e as observações foram alterados. Para mudar o valor, peça um novo orçamento.",
  };
}

const esquemaDecisao = z.object({
  id: z.uuid(),
  decisao: z.enum(["liberar", "recusar", "novo_orcamento"]),
  observacao: texto(1000),
});

const STATUS_DA_DECISAO = { liberar: "liberado", recusar: "recusado", novo_orcamento: "novo_orcamento" } as const;

/** A análise do Setor de Frotas: libera o serviço, recusa ou pede novo orçamento. */
export async function decidirOrcamento(dados: z.input<typeof esquemaDecisao>): Promise<Resultado> {
  const a = esquemaDecisao.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas analisa orçamentos.");
  const frotas = await criarClienteFrotas();
  const { data: atual, error: erroLeitura } = await frotas.from("manutencoes").select("orcamento_recebido_em").eq("id", a.data.id).eq("status_analise", "a_analisar").maybeSingle();
  if (erroLeitura) return falha(traduzir(erroLeitura));
  if (!atual) return falha("Este orçamento já foi decidido ou não existe mais.");
  const hoje = dataNoFuso(new Date());
  const { error } = await frotas
    .from("manutencoes")
    .update({
      status_analise: STATUS_DA_DECISAO[a.data.decisao],
      analisado_em: hoje < atual.orcamento_recebido_em ? atual.orcamento_recebido_em : hoje,
      analise_obs: a.data.observacao,
    })
    .eq("id", a.data.id)
    .eq("status_analise", "a_analisar");
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: a.data.id };
}

const esquemaDocumentos = z.object({
  id: z.uuid(),
  ocNumero: texto(40),
  ocValor: dinheiro.nullable().optional().transform((v) => v ?? null),
  ocEmitidaEm: dataOpcional,
  ocEnviadaEm: dataOpcional,
  nfNumero: texto(40),
  nfEmissao: dataOpcional,
  nfValor: dinheiro.nullable().optional().transform((v) => v ?? null),
  docsRetornaramEm: dataOpcional,
  enviadaContabilidadeEm: dataOpcional,
  observacoes: texto(2000),
});

/** OC do IPM, NF da oficina e as datas de cada etapa. O banco confere a ordem. */
export async function registrarDocumentos(dados: z.input<typeof esquemaDocumentos>): Promise<Resultado> {
  const a = esquemaDocumentos.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera manutenções.");
  const d = a.data;
  const frotas = await criarClienteFrotas();
  const { data: atual, error: erroLeitura } = await frotas.from("manutencoes").select("status_analise").eq("id", d.id).single();
  if (erroLeitura) return falha("Manutenção não encontrada.");
  if (atual.status_analise !== "liberado" && (d.ocNumero || d.nfNumero)) return falha("Libere o serviço antes de registrar a OC e a NF.");

  const { error } = await frotas
    .from("manutencoes")
    .update({
      oc_numero: d.ocNumero,
      oc_valor: d.ocValor,
      oc_emitida_em: d.ocEmitidaEm,
      oc_enviada_em: d.ocEnviadaEm,
      nf_numero: d.nfNumero,
      nf_emissao: d.nfEmissao,
      nf_valor: d.nfValor,
      docs_retornaram_em: d.docsRetornaramEm,
      enviada_contabilidade_em: d.enviadaContabilidadeEm,
      observacoes: d.observacoes,
    })
    .eq("id", d.id);
  if (error) return falha(traduzir(error));

  const aviso =
    d.nfValor !== null && d.ocValor !== null && d.nfValor > d.ocValor
      ? "O valor da NF passa do valor da OC. Confira com a oficina antes de seguir."
      : undefined;
  atualizarTelas();
  return { sucesso: true, id: d.id, aviso };
}

export async function excluirManutencao(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("Dados inválidos");
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera manutenções.");
  const frotas = await criarClienteFrotas();
  const { error } = await frotas.from("manutencoes").delete().eq("id", id);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}

// ------------------------------------------------------------- cadastros de apoio e parâmetros

const esquemaFornecedor = z.object({
  id: z.uuid().optional(),
  tipo: z.enum(["posto", "oficina", "locadora"]),
  nome: z.string().trim().min(2, "Informe o nome").max(160),
  cnpj: texto(18),
  ativo: z.boolean(),
});

export async function salvarFornecedor(dados: z.input<typeof esquemaFornecedor>): Promise<Resultado> {
  const a = esquemaFornecedor.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera cadastros.");
  const { id, ...resto } = a.data;
  const frotas = await criarClienteFrotas();
  if (id) {
    const { error } = await frotas.from("fornecedores").update(resto).eq("id", id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id };
  }
  const { data: criado, error } = await frotas.from("fornecedores").insert(resto).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criado.id };
}

const esquemaSecretaria = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  controlaCombustivel: z.boolean(),
  ativa: z.boolean(),
});

export async function salvarSecretaria(dados: z.input<typeof esquemaSecretaria>): Promise<Resultado> {
  const a = esquemaSecretaria.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera cadastros.");
  const linha = { nome: a.data.nome, controla_combustivel: a.data.controlaCombustivel, ativa: a.data.ativa };
  const frotas = await criarClienteFrotas();
  if (a.data.id) {
    const { error } = await frotas.from("secretarias").update(linha).eq("id", a.data.id);
    if (error) return falha(traduzir(error));
    atualizarTelas();
    return { sucesso: true, id: a.data.id };
  }
  const { data: criada, error } = await frotas.from("secretarias").insert(linha).select("id").single();
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true, id: criada.id };
}

const inteiro = (min: number, max: number) => z.number().int().min(min).max(max);
const esquemaParametros = z.object({
  diasAtencao: inteiro(1, 365),
  diasCritico: inteiro(1, 365),
  pctAtencao: inteiro(1, 1000),
  pctCritico: inteiro(1, 1000),
  reincidenciaQtd: inteiro(2, 50),
  reincidenciaMeses: inteiro(1, 60),
  orcamentoAcimaPct: inteiro(1, 500),
  combustivelAcimaPct: inteiro(1, 500),
  inativoDias: inteiro(1, 730),
});

export async function salvarParametros(dados: z.input<typeof esquemaParametros>): Promise<Resultado> {
  const a = esquemaParametros.safeParse(dados);
  if (!a.success) return invalido(a.error);
  if (!(await exigirGestor())) return falha("Só o Setor de Frotas altera os limites dos alertas.");
  const p = a.data;
  if (p.diasCritico < p.diasAtencao) return falha("O prazo de “atenção” não pode ser maior que o “crítico”.");
  if (p.pctCritico < p.pctAtencao) return falha("O percentual de “atenção” não pode ser maior que o “crítico”.");
  const frotas = await criarClienteFrotas();
  const { error } = await frotas
    .from("parametros")
    .update({
      dias_atencao: p.diasAtencao,
      dias_critico: p.diasCritico,
      pct_atencao: p.pctAtencao,
      pct_critico: p.pctCritico,
      reincidencia_qtd: p.reincidenciaQtd,
      reincidencia_meses: p.reincidenciaMeses,
      orcamento_acima_pct: p.orcamentoAcimaPct,
      combustivel_acima_pct: p.combustivelAcimaPct,
      inativo_dias: p.inativoDias,
    })
    .eq("id", 1);
  if (error) return falha(traduzir(error));
  atualizarTelas();
  return { sucesso: true };
}
