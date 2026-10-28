/**
 * Conteúdo vivo da página `/novidades` — módulo puro, editado no código a
 * cada mudança visível ao usuário no Hub (convenção fixada em
 * CLAUDE.md deste repositório: "toda mudança visível ganha uma entrada
 * aqui, no mesmo commit"). Mais recente primeiro.
 */

export type Novidade = {
  data: string; // AAAA-MM-DD
  titulo: string;
  descricao: string;
};

export const NOVIDADES: Novidade[] = [
  {
    data: "2026-10-29",
    titulo: "Emendas: botão único “Exportar”",
    descricao:
      "Na lista de Emendas e em cada relatório, os botões de download viraram um só “Exportar”, que abre as opções (Excel, PDF, CSV). Em Relatórios, o menu do topo também baixa todos os relatórios em PDF ou imprime a página.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: exportação em PDF",
    descricao:
      "A lista de Emendas ganhou “Exportar PDF” (respeita os filtros e as permissões de quem exporta) e a tela de Relatórios ganhou “Baixar PDF” em cada relatório e “Baixar todos em PDF”. Os PDFs saem em paisagem, com total e rodapé de página.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: ajustes após o teste de uso",
    descricao:
      "Pendências: cada cartão mostra “Abrir emenda nº …”, e as pendências justificadas podem ser vistas (com a data da justificativa) marcando “Mostrar justificadas”. Nova pendência “Objeto pouco descritivo” e o cadastro passa a exigir ao menos 15 caracteres no objeto. Painel: aviso claro de que pagamentos sem data ficam fora da curva (e por isso ela difere do total pago). Nome do vereador igual na lista e nos filtros. Telas de Emendas e Pendências ganham esqueleto de carregamento.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: base legal à vista",
    descricao:
      "Pendências, fases, documentos, impedimento, lançamentos financeiros, parceria (extrato, conta, vigência), Saúde (“?” no indicador), exequibilidade, relatórios e portal público agora citam a lei que fundamenta cada exigência (CF art. 166 por simetria, Leis 4.320, 13.019, 14.133, LAI, LRF e IN TCE-MG 05/2025). Os percentuais e prazos próprios do município seguem a Lei Orgânica: confira com o jurídico.",
  },
  {
    data: "2026-10-28",
    titulo: "Emendas: ajustes após o primeiro teste",
    descricao:
      "O selo de pendências na lista agora diz “1 pendência” em vez de só o número. A parcela da cota na Saúde por vereador mostra uma casa decimal (49,6% deixa de aparecer como 50%). O painel explica por que a divisão por natureza da despesa pode diferir dos cartões por tipo de execução.",
  },
  {
    data: "2026-10-28",
    titulo: "Emendas: os três números do processo ficam separados e explicados",
    descricao:
      "O quadro “Processo no Compras” agora mostra, em linhas separadas, o número do processo (Compras), da licitação e do contrato (setor de Contratos), cada um com a fase da emenda em que vale. A busca também acha pelo número do contrato, e a lista de sugestões ficou mais larga, com o objeto em até 3 linhas.",
  },
  {
    data: "2026-10-28",
    titulo: "Emendas: busca de processos do Compras com sugestões",
    descricao:
      "No vínculo com o Compras, o campo agora sugere processos pelo objeto da emenda e filtra enquanto você digita (parte do número ou palavras do objeto). Um “?” explica que processo e licitação são o mesmo processo com dois números. Nas fases DFD/ETP/TR, pesquisa de preços, contratação e contrato, o campo de documento traz atalhos com os números do processo vinculado.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: vínculo com o Compras passa por aprovação e mais proteções",
    descricao:
      "Quem não é gestor agora envia o vínculo de um processo do Compras para aprovação do gestor (antes ligava direto), para que o cadastro de Emendas não sirva de atalho para ver processos de outros setores. Por trás: as propostas só aplicam campos e valores conhecidos, o checklist só aceita itens do tipo da emenda e uma biblioteca de validação foi atualizada por uma falha de segurança.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: editor de fases e documentos e impedimento em lote",
    descricao:
      "Em Configurações › “Fases e documentos por tipo”, o gestor agora cria, renomeia, reordena, ativa e remove as fases e os itens do checklist de cada tipo (direta, OSC e ente), sem depender de SQL; fase já usada em emendas só pode ser desativada. Em Configurações › Exequibilidade, depois de registrar o parecer da secretaria, dá para marcar de uma vez as emendas não exequíveis e registrar o impedimento técnico em todas, com a justificativa do parecer.",
  },
  {
    data: "2026-10-28",
    titulo: "Cards da Central do mesmo tamanho e cores mais visíveis nas Emendas",
    descricao:
      "Os cards de módulos na tela inicial agora têm sempre a mesma altura, com o botão alinhado embaixo. Nas Emendas, cada linha da lista ganhou uma faixa de cor mais larga e um leve fundo na cor do tipo (direta, OSC ou ente), e o selo do tipo virou uma etiqueta colorida; o mesmo vale no painel e no portal público.",
  },
  {
    data: "2026-10-28",
    titulo: "Emendas: atalho para o portal público",
    descricao:
      "Ao lado de Configurações, o menu do módulo Emendas ganhou o botão “Portal público”, que abre em outra aba a página de transparência que o cidadão vê, sem senha.",
  },
  {
    data: "2026-10-28",
    titulo: "Emendas: portal público de transparência e relatórios",
    descricao:
      "Qualquer pessoa, sem senha, pode consultar as emendas impositivas em /transparencia/emendas: quem indicou, objeto, valor, beneficiário, fase, empenhado e pago, com busca e filtros por vereador, tipo e secretaria, e dados abertos em CSV e JSON. A conta bancária aparece mascarada e não há dado pessoal. Dentro do módulo, a nova tela Relatórios traz execução por vereador e por secretaria, recursos por beneficiário, parcerias com prestação de contas e impedimentos em aberto, para imprimir ou baixar em CSV (apoio à IN TCE-MG 05/2025).",
  },
  {
    data: "2026-10-27",
    titulo: "Emendas: aprovações, importação do controle e ligação com o Compras",
    descricao:
      "Alterações em dado já preenchido (feitas por uma secretaria ou vindas de uma importação) agora esperam a aprovação do gestor na nova tela Aprovações, com o valor de hoje e o proposto lado a lado; a secretaria acompanha em “Minhas propostas”. Campo vazio continua sendo preenchido na hora. Em Configurações › Importar, o arquivo JSON exportado do HTML de controle gera as propostas (termo, vigência, extrato, conta, gestores, fases e documentos) sem apagar nada do que já existe. No detalhe da emenda, informar o número do processo (2026/0062) ou da licitação (136/2026) traz os dados do Compras e abre o processo lá com um clique.",
  },
  {
    data: "2026-10-27",
    titulo: "Emendas: tipos de execução, fases, documentação e pendências",
    descricao:
      "Cada emenda agora tem um tipo (execução direta, repasse a OSC ou entes e conveniadas), marcado por uma faixa de cor na lista, com abas Consolidado/Direta/OSC/Ente e um cartão por tipo no Painel. No detalhe da emenda há as abas Fases (cada fase com situação, data e documento; empenho, pagamento, termo, extrato, LOA e parecer vêm sozinhos dos outros cadastros, sem digitar de novo), Documentação (checklist por tipo, com a base legal) e Pendências (o que merece atenção do gestor, com opção de justificar). A nova tela Pendências lista tudo por gravidade, tipo e secretaria. Em Configurações › Exercício ficam a data de aprovação da LOA e o prazo de exequibilidade, uma vez só para o ano todo; em Configurações › Exequibilidade, o parecer de cada secretaria.",
  },
  {
    data: "2026-10-25",
    titulo: "Links de e-mail com um clique de confirmação",
    descricao:
      "Os links de redefinir senha e de primeiro acesso agora abrem uma página com o botão “Continuar”. Antivírus e prévias de e-mail abriam o link antes da pessoa e gastavam o código de uso único, o que causava o aviso de “link inválido”. Para entrar, basta tocar no botão.",
  },
  {
    data: "2026-10-24",
    titulo: "Mais rapidez e mais segurança",
    descricao:
      "Filtrar o painel e a lista de Emendas agora é instantâneo: os cliques não vão mais ao servidor, só trocar o exercício busca dados novos. A verificação de acesso do módulo ficou mais rápida, as telas mostram um esqueleto enquanto carregam (e uma mensagem amigável se algo falhar) e salvar uma ação na emenda não recarrega a página duas vezes. Por trás: atualização do Next.js com correções de segurança, proteção contra a plataforma ser aberta dentro de outro site, avisos que não aparecem para quem entra depois no mesmo computador e buscas por nome/e-mail mais estritas.",
  },
  {
    data: "2026-10-24",
    titulo: "Emendas: atualizadas pela planilha de cumprimento",
    descricao:
      "As 87 emendas da planilha de cumprimento de 2026 foram atualizadas na plataforma: empenhos e datas de pagamento corrigidos, pagamentos e empenhos que faltavam, e a fase de cada uma. Cada emenda ganhou o bloco “Parceria e execução” (termo de parceria, vigência, publicação do extrato, envio para pagamento, conta bancária e gestores), editável por quem registra a execução, com alerta quando a vigência está acabando ou o extrato ainda não foi publicado. Duas fases novas no fluxo: Termo de parceria (repasse) e Enviada para pagamento. A exportação para Excel traz as colunas novas.",
  },
  {
    data: "2026-10-23",
    titulo: "Avisos ao vivo em toda a plataforma",
    descricao:
      "Novo sino no cabeçalho da Central e do Requerimentos: os avisos chegam na hora, sem atualizar a página, com um alerta no canto da tela. Cada card de módulo na Início mostra quantos avisos não lidos vieram dele. No Requerimentos, o Gabinete e o Admin são avisados quando uma secretaria dá ciência, responde ou pede prorrogação; a secretaria é avisada quando recebe um requerimento, quando há documento novo e quando ele é devolvido à Câmara; e todos recebem lembrete 3 dias antes do prazo e no dia do vencimento. A lista de requerimentos mostra a situação de cada secretaria (aguardando ciência, ciente, respondida) e se atualiza sozinha. No Emendas, gestores são avisados de andamentos, impedimentos, empenhos e pagamentos; na Central, admins são avisados de cada pedido de acesso. Os avisos do Compras continuam no próprio Compras e passam a contar no selo do card a partir de hoje.",
  },
  {
    data: "2026-10-22",
    titulo: "Emendas: fases do fluxo editáveis",
    descricao:
      "Em Emendas → Configurações → Fases do fluxo, o administrador e o gestor podem adicionar, renomear, recolorir, reordenar, desativar ou excluir as fases do fluxo, com um fluxo para repasse a entidade e outro para aplicação direta. Indicada, Empenhada, Liquidada, Paga e Concluída são fixas (alimentam os totais de empenhado e pago). Desativar uma fase tira ela das novas opções sem perder o histórico; só uma fase nunca usada pode ser excluída. Painel, lista, detalhe e exportação passam a usar as fases configuradas. Também mudou: as permissões do módulo agora são definidas só pelo administrador ou pelo gestor — o admin de secretaria deixou de ajustar a própria equipe.",
  },
  {
    data: "2026-10-21",
    titulo: "Solicitar acesso a um módulo com um clique",
    descricao:
      "Na tela inicial, os módulos que você ainda não tem continuam aparecendo, em cinza, com o botão “Solicitar acesso”. Basta clicar para enviar o pedido ao administrador — sem preencher nada, porque seu nome e e-mail já vêm da sua conta. Enquanto o pedido não for decidido, o card mostra “Solicitação enviada — aguardando aprovação”, e o mesmo pedido não é enviado duas vezes.",
  },
  {
    data: "2026-10-21",
    titulo: "Link de primeiro acesso que não expira até ser usado",
    descricao:
      "Quem acaba de ganhar acesso recebe um único link para definir a senha, que vale para todos os módulos (a senha do Numera acompanha a da Central). Em Configurações → Usuários e acessos, o link fica visível sob o nome da pessoa enquanto ela não acessar, com botão de copiar, e some sozinho depois do primeiro acesso. O link também é enviado por e-mail à pessoa assim que a conta é criada, e o administrador pode reenviá-lo a qualquer momento pelo botão “Enviar por e-mail”. Para quem já estava na lista e ainda não entrou, há o botão “Gerar link de primeiro acesso”. Também corrigimos o destino logo após o login pela tela inicial de entrada, que podia cair numa página inexistente.",
  },
  {
    data: "2026-10-21",
    titulo: "Novo módulo: Emendas Impositivas",
    descricao:
      "As emendas dos vereadores agora são acompanhadas dentro da própria Central, sem segundo login: painel com execução por vereador e por secretaria, funil de etapas, curva de pagamentos e alertas (paradas, impedidas, empenho repetido…); lista com a situação de cada emenda; detalhe com andamentos, empenhos e pagamentos, documentos anexados e histórico de remanejamentos. O sistema confere a cota de cada vereador e a regra dos 50% na Saúde. Cada pessoa vê e edita só as secretarias liberadas para ela — o acesso é concedido pela Central, como nos outros módulos. A planilha de acompanhamento de 2026 pode ser importada direto em Configurações → Importar planilha.",
  },
  {
    data: "2026-09-24",
    titulo: "Correção: link de \"esqueci minha senha\" e nova tela \"Minha conta\"",
    descricao:
      "O link do e-mail de recuperação de senha levava de volta à tela de login em vez de abrir a redefinição — corrigido. Também chegou uma tela \"Minha conta\" (clique no seu nome, no topo): para quem lembra a senha atual, dá para trocá-la ali mesmo, sem sair do Hub nem depender de e-mail; \"Esqueci minha senha\" continua sendo o caminho para quem não lembra.",
  },
  {
    data: "2026-09-24",
    titulo: "Peça acesso pela Central Cataguases",
    descricao:
      "Nova página \"Solicitar acesso\", com um link direto na tela de login: preencha nome, e-mail e a quais sistemas você precisa (Compras, Numera, Requerimentos), e o administrador aprova cada um com a configuração certa (perfil e setor no Compras, perfil e secretaria no Requerimentos, nível e documentos no Numera). Se você já tem conta em algum sistema, o pedido só adiciona o que falta — nunca cria uma conta duplicada. Quando a conta é nova, você recebe um link de primeiro acesso para definir sua senha, sem depender de e-mail chegar.",
  },
  {
    data: "2026-09-22",
    titulo: "Navegação e tela de acessos melhoradas",
    descricao:
      "Toda tela do Hub (Início, Configurações, Novidades) agora tem o mesmo cabeçalho, com o brasão sempre levando à Início — antes, Configurações não tinha nenhum jeito de voltar sem usar o botão do navegador. A lista de usuários em Configurações também ficou mais clara: cada módulo virou uma coluna própria com um ícone colorido mostrando quem tem acesso a quê, em vez de rótulos de texto empilhados.",
  },
  {
    data: "2026-09-22",
    titulo: "A Central Cataguases chegou",
    descricao:
      "Um único lugar para acessar os sistemas da Prefeitura — hoje Compras/Licitações/Contratos, Numeração de Documentos e Requerimentos da Câmara. O login de cada sistema continua sendo o mesmo que você já usa: a Central só reúne os cards de acesso, sem trocar sua senha nem seus dados. Quem já tinha conta no Compras já entra aqui com o módulo liberado automaticamente; quem só tinha conta no Numera recebe acesso pelo administrador e define uma senha nova por \"Esqueci minha senha\" no primeiro acesso, já que o Numera usa um banco de dados separado.",
  },
];
