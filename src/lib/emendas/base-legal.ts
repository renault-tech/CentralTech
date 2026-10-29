/**
 * Fundamentos legais citados nas telas do módulo Emendas. Um lugar só, para a redação ficar
 * igual em toda parte e ser revisada por quem entende (jurídico/controle interno).
 *
 * Atenção: a execução impositiva de emendas de VEREADORES é regida pela Lei Orgânica do Município;
 * as regras da CF (art. 166) valem aqui por simetria. Confirme os percentuais e prazos locais na LOM.
 */
export type BaseLegal = { citacao: string; resumo: string };

export const BASES: Record<string, BaseLegal> = {
  impedimento: {
    citacao: "CF, art. 166, §§ 13 e 14 (por simetria)",
    resumo:
      "A execução da emenda é obrigatória, salvo impedimento de ordem técnica, que deve ser justificado e, se não superado, leva ao remanejamento da programação.",
  },
  execucao_obrigatoria: {
    citacao: "CF, art. 166, §§ 9º a 11 (por simetria); Lei Orgânica do Município",
    resumo: "Emendas individuais têm execução orçamentária e financeira obrigatória no exercício, dentro do limite definido na Lei Orgânica.",
  },
  saude: {
    citacao: "CF, art. 166, §§ 9º e 9º-A (reprodução obrigatória: ADIs 6670 e 7493, STF; IN TCE-MG 05/2025, art. 8º, X); Lei Orgânica do Município",
    resumo: "Os entes municipais devem observar os percentuais da CF para emendas individuais e a parcela destinada a ações e serviços públicos de saúde.",
  },
  exequibilidade: {
    citacao: "CF, art. 166, §§ 13 e 14 (por simetria)",
    resumo: "As secretarias analisam, dentro do prazo, se cada emenda é tecnicamente exequível; o impedimento deve ser justificado.",
  },
  empenho: {
    citacao: "Lei 4.320/1964, arts. 58 a 60",
    resumo: "O empenho cria a obrigação de pagamento e não pode exceder o crédito orçamentário concedido (art. 59).",
  },
  liquidacao: {
    citacao: "Lei 4.320/1964, arts. 62 e 63",
    resumo: "A liquidação verifica o direito do credor com base nos documentos que comprovam a entrega do bem ou serviço.",
  },
  pagamento: {
    citacao: "Lei 4.320/1964, arts. 62 a 65; Lei 14.133/2021, art. 141",
    resumo: "O pagamento só ocorre depois da liquidação regular e, nas compras públicas, segue a ordem cronológica das exigibilidades.",
  },
  dfd_etp_tr: {
    citacao: "Lei 14.133/2021, arts. 12, VII; 18 e 40",
    resumo: "A fase preparatória reúne o documento de formalização da demanda, o estudo técnico preliminar e o termo de referência.",
  },
  pesquisa_precos: {
    citacao: "Lei 14.133/2021, art. 23",
    resumo: "O valor estimado da contratação decorre de pesquisa de preços em fontes diversas e compatíveis com o mercado.",
  },
  termo_extrato: {
    citacao: "Lei 13.019/2014, art. 38",
    resumo: "O extrato do termo de fomento ou de colaboração deve ser publicado em meio oficial como condição de eficácia.",
  },
  publicidade: {
    citacao: "IN TCE-MG 05/2025, art. 7º e § 2º; Recomendação MPC-MG 01/2025",
    resumo: "Os 17 elementos do art. 7º devem ser divulgados em meio digital de acesso público ANTES da execução orçamentária e financeira da emenda.",
  },
  plano_publico: {
    citacao: "IN TCE-MG 05/2025, art. 7º, IX; ADPF 854 (STF)",
    resumo: "O Plano de Trabalho (objeto, finalidade, metas, estimativa de recursos, classificação corrente/capital, prazo e cronograma) deve ser divulgado antes do recebimento dos recursos.",
  },
  relatorio_gestao: {
    citacao: "IN TCE-MG 05/2025, art. 7º, X e § 1º",
    resumo: "O relatório de gestão dos recursos é divulgado até 30 de junho do ano seguinte ao recebimento e atualizado a cada 30 de junho, até o relatório final.",
  },
  anuencia_sus: {
    citacao: "IN TCE-MG 05/2025, art. 7º, XVII; Recomendação MPC-MG 01/2025, art. 2º, § 3º",
    resumo: "Emendas de saúde devem informar se houve anuência prévia do gestor do SUS e ser aprovadas pelas instâncias de governança do SUS.",
  },
  contabil: {
    citacao: "IN TCE-MG 05/2025, arts. 4º e 5º; Portaria STN/MF 1.307/2024",
    resumo: "Cada despesa deve poder ser ligada à emenda que a originou, por fonte de recurso, código ou identificador único no plano de contas.",
  },
  conta_parceria: {
    citacao: "Lei 13.019/2014, art. 51; IN TCE-MG 05/2025, art. 6º",
    resumo: "Os recursos da parceria ficam em conta bancária específica, aberta para essa finalidade, e não se misturam com outros.",
  },
  prestacao_contas: {
    citacao: "Lei 13.019/2014, art. 69",
    resumo: "A entidade presta contas ao fim da vigência, no prazo definido no termo (até 90 dias, conforme o termo).",
  },
  natureza_despesa: {
    citacao: "Portaria Interministerial STN/SOF nº 163/2001",
    resumo: "O 3º grupo da natureza da despesa distingue transferência a entidade sem fins lucrativos (50) de aplicação direta (90).",
  },
  portal: {
    citacao: "Lei 12.527/2011 (LAI), arts. 8º e 9º; LC 101/2000 (LRF), art. 48-A; IN TCE-MG 05/2025",
    resumo: "Transparência ativa: a execução das emendas é divulgada em meio eletrônico, sem exigir cadastro, em formatos abertos.",
  },
  lgpd: {
    citacao: "Lei 13.709/2018 (LGPD)",
    resumo: "O portal não mostra CPF, dados de dirigentes nem a conta bancária completa (só os 4 últimos dígitos).",
  },
};

/** Fundamento de cada regra de pendência (chave = início de `regra`, sem o que vem depois de ":"). */
export const BASE_DA_PENDENCIA: Record<string, keyof typeof BASES> = {
  impedimento: "impedimento",
  empenho_maior: "empenho",
  pago_maior: "pagamento",
  tipo_incoerente: "natureza_despesa",
  termo_sem_extrato: "termo_extrato",
  sem_conta: "conta_parceria",
  vigencia: "prestacao_contas",
  nao_iniciada: "execucao_obrigatoria",
  publicidade_incompleta: "publicidade",
  conta_repetida: "conta_parceria",
  conta_banco_nao_oficial: "conta_parceria",
  relatorio_gestao: "relatorio_gestao",
  exequibilidade_vencida: "exequibilidade",
};

export function baseDaPendencia(regra: string): string | undefined {
  const chave = BASE_DA_PENDENCIA[regra.split(":")[0]];
  return chave ? BASES[chave].citacao : undefined;
}
