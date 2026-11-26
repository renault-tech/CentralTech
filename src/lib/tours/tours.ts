/**
 * Registro dos tours guiados do Hub — mesmo mecanismo já usado no
 * App-Compras (Bloco 5 do punch list de lá), portado para este repo.
 * Módulo puro (sem DOM/driver.js), para não puxar a biblioteca de tour
 * só por importar a lista.
 */

export type PassoTour = {
  seletor: string;
  titulo: string;
  descricao: string;
  lado?: "top" | "right" | "bottom" | "left";
};

export type Tour = {
  id: string;
  nome: string;
  descricao: string;
  /** Rota onde este tour roda. Vazio = disponível em qualquer tela. */
  rota: string;
  /** Outras rotas (prefixos) onde o mesmo tour vale. */
  rotasExtras?: string[];
  passos: PassoTour[];
  /** Classe extra do balão (ex.: tema do portal público). */
  classePopover?: string;
};

export const TOURS: Tour[] = [
  {
    id: "boas-vindas-hub",
    nome: "Boas-vindas",
    descricao: "O que é a Central Cataguases e como o acesso aos módulos funciona",
    rota: "",
    passos: [
      {
        seletor: '[data-tour="marca-hub"]',
        titulo: "Central Cataguases",
        descricao:
          "Um único lugar para acessar os sistemas da Prefeitura. O login continua sendo o mesmo que você já usa em cada um deles.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="cards-modulos"]',
        titulo: "Seus módulos",
        descricao:
          "Cada card leva ao sistema real, na conta que você já tem lá. Só aparecem aqui os módulos liberados para você — se faltar algum, peça ao administrador. Dentro de cada módulo, o menu lateral, os gráficos que filtram e o resumo ao lado da lista seguem o mesmo padrão.",
        lado: "top",
      },
      {
        seletor: '[data-tour="link-novidades"]',
        titulo: "Novidades",
        descricao: "Acompanhe por aqui o que muda na plataforma, com data de cada atualização.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="botao-ajuda"]',
        titulo: "Precisa rever isso?",
        descricao: "Clique aqui a qualquer momento para repetir este tour.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "emendas-painel",
    nome: "Emendas Impositivas",
    descricao: "Como ler o painel das emendas e acompanhar a execução",
    rota: "/emendas",
    passos: [
      {
        seletor: '[data-tour="nav-emendas"]',
        titulo: "Módulo Emendas",
        descricao:
          "Painel para a visão geral, Emendas para a lista completa, Vereadores para a cota de cada um (com relatório em PDF) e Secretarias para a execução por área.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="indicadores-emendas"]',
        titulo: "Execução do exercício",
        descricao:
          "O total indicado partido em pago, empenhado a pagar e sem empenhar, com a situação das emendas logo abaixo. Clicar num número abre a lista já filtrada.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="atencao-emendas"]',
        titulo: "O que precisa da sua atenção",
        descricao:
          "Pendências graves, propostas a aprovar, emendas paradas e outros pontos, com a quantidade de cada um. Só aparece o que tem alguma emenda envolvida; clicar leva à tela já filtrada.",
        lado: "left",
      },
    ],
  },
  {
    id: "frotas-painel",
    nome: "Frotas",
    descricao: "Como ler o painel de abertura do Setor de Frotas",
    rota: "/frotas",
    passos: [
      {
        seletor: '[data-tour="nav-frotas"]',
        titulo: "Módulo Frotas",
        descricao:
          "Painel para o que está pendente, Combustível para as NFs de cada secretaria, Manutenção para o caminho do orçamento até a Contabilidade, Veículos para o cadastro e Análise da frota para o custo de cada veículo.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="resumo-frotas"]',
        titulo: "Em andamento na frota",
        descricao:
          "O dinheiro das manutenções abertas dividido por etapa (orçamento, liberado, OC emitida, NF registrada) e quantos documentos há em cada situação. Clicar num cartão abre a lista já filtrada. Em vermelho, o que passou do prazo de alerta.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="quinzena-frotas"]',
        titulo: "Quinzena de combustível",
        descricao: "Cada secretaria deve ter uma NF por quinzena. Aqui aparecem as que ainda não mandaram a da quinzena anterior.",
        lado: "left",
      },
    ],
  },
  {
    id: "area-trabalho",
    nome: "Gráficos, lista e detalhe",
    descricao: "Como filtrar pelos gráficos e abrir o resumo ao lado da lista",
    rota: "/emendas/lista",
    rotasExtras: [
      "/emendas/pendencias",
      "/emendas/conformidade",
      "/emendas/panorama",
      "/frotas/manutencao",
      "/frotas/combustivel",
      "/frotas/veiculos",
      "/imoveis/imoveis",
      "/imoveis/pendencias",
      "/imoveis/entregas",
    ],
    passos: [
      {
        seletor: '[data-tour="ws-graficos"]',
        titulo: "Gráficos que filtram",
        descricao:
          "Clique numa fatia, barra ou linha e a lista mostra só aquilo; clique de novo para tirar. Cada gráfico tem um seletor para trocar o que mostra, e dois gráficos se combinam. Os filtros ativos aparecem como etiquetas com ✕, e “Limpar” tira todos. A faixa lateral recolhe os gráficos para dar espaço à lista.",
        lado: "right",
      },
      {
        seletor: '[data-tour="ws-lista"]',
        titulo: "A lista",
        descricao:
          "Busque pelo texto, ordene e exporte exatamente o que está na tela. Clique numa linha para abrir o resumo ao lado, sem perder o filtro; as setas do teclado passam de um item ao outro e Esc fecha. O que você filtrou fica guardado ao voltar de um item.",
        lado: "left",
      },
      {
        seletor: '[data-tour="ws-detalhe"]',
        titulo: "Resumo ao lado",
        descricao: "O resumo traz abas com o que importa do item. Quem pode editar faz as ações ali mesmo; “Expandir” dá mais espaço e, no celular, o resumo abre como uma folha por cima da lista.",
        lado: "left",
      },
      {
        seletor: '[data-tour="ws-alca"]',
        titulo: "Alça: largura da lista e do resumo",
        descricao: "Arraste a alça entre a lista e o resumo (ou use as setinhas e o teclado: ← → ajustam, Enter expande) para dar mais espaço a um dos dois. Sua escolha fica guardada neste navegador.",
        lado: "left",
      },
    ],
  },
  {
    id: "imoveis-painel",
    nome: "Imóveis e Consumo",
    descricao: "Como ler o painel de abertura de imóveis, água e luz",
    rota: "/imoveis",
    passos: [
      {
        seletor: '[data-tour="nav-imoveis"]',
        titulo: "Módulo Imóveis e Consumo",
        descricao:
          "Painel para a visão geral, Imóveis para o cadastro e os contratos, Água e Luz para as contas de cada unidade, Entregas para a devolução de imóveis, Vencimentos e Pendências para o que precisa de ação. Recolha o menu com o botão dele ou com a tecla [.",
        lado: "bottom",
      },
    ],
  },
  {
    id: "portal-emendas",
    nome: "Portal das emendas",
    descricao: "Como usar o portal público das emendas impositivas",
    rota: "/transparencia/emendas",
    classePopover: "portal-tour",
    passos: [
      { seletor: '[data-tour="portal-heroi"]', titulo: "Bem-vindo ao portal das emendas", descricao: "Aqui você acompanha, sem senha, cada real das emendas impositivas dos vereadores: quanto foi indicado, quanto já foi empenhado e quanto já foi pago.", lado: "bottom" },
      { seletor: '[data-tour="portal-execucao"]', titulo: "Pago e pendente, num olhar", descricao: "A barra divide o valor em três partes: já pago, empenhado aguardando pagamento e ainda não empenhado. Passe o mouse para ver os valores exatos.", lado: "bottom" },
      { seletor: '[data-tour="portal-filtros"]', titulo: "Filtros que mudam tudo", descricao: "Escolha o exercício, um vereador, uma secretaria, o tipo, a situação ou a área. Os números, gráficos e a lista se atualizam na hora — e o link da página guarda o filtro.", lado: "bottom" },
      { seletor: '[data-tour="portal-vereadores"]', titulo: "Clique para filtrar", descricao: "Cada barra é um botão: clique num vereador ou numa secretaria para ver só as emendas dele. Clique de novo para voltar.", lado: "top" },
      { seletor: '[data-tour="portal-curva"]', titulo: "Ritmo dos pagamentos", descricao: "Quanto foi pago mês a mês no ano, acumulado. Passe o mouse ao longo da curva.", lado: "top" },
      { seletor: '[data-tour="portal-lista"]', titulo: "Cada emenda, em detalhe", descricao: "Ordene por valor ou pelo que falta pagar e toque numa emenda para ver tudo o que a IN TCE-MG 05/2025 manda divulgar, com as datas de cada empenho e pagamento.", lado: "top" },
      { seletor: '[data-tour="portal-boletim"]', titulo: "Novidades no seu e-mail", descricao: "Cadastre-se para receber só o que mudar. O e-mail serve apenas para isso e pode ser cancelado quando quiser.", lado: "top" },
      { seletor: '[data-tour="portal-ajuda"]', titulo: "Guia sempre à mão", descricao: "O guia explica cada termo e como ler os gráficos. Este tour pode ser repetido por aqui.", lado: "bottom" },
    ],
  },
];

/** Tour cuja rota é prefixo exato do pathname atual (a rota vazia do boas-vindas nunca "casa" aqui). */
export function tourPorRota(pathname: string): Tour | undefined {
  const acertos: { tour: Tour; tamanho: number }[] = [];
  for (const t of TOURS) {
    for (const r of [t.rota, ...(t.rotasExtras ?? [])]) {
      if (r && pathname.startsWith(r)) acertos.push({ tour: t, tamanho: r.length });
    }
  }
  return acertos.sort((a, b) => b.tamanho - a.tamanho)[0]?.tour;
}

export function tourPorId(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}
