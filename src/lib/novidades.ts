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
    data: "2026-11-13",
    titulo: "Emendas: arredondamento de centavos, com o valor real preservado",
    descricao: "Diferenças de até R$ 1,00 entre o valor da emenda e o empenhado/pago deixam de manter a fase como parcial. O lançamento real não muda (o empenhado e o pago seguem iguais ao IPM, e é isso que o portal público mostra): grava-se um registro discreto de arredondamento, com o valor real na observação, que apenas faz a fase contar como completa. Na aba Financeiro, o gestor vê o registro em cinza, pode desfazê-lo a qualquer momento (\"Desfazer\") ou aplicá-lo em outra emenda (\"Arredondar centavos\"). Já aplicado em 10 emendas (18, 21, 31, 64, 68, 119, 161, 166, 188, 198). Diferenças maiores que R$ 1,00 (como R$ 12,37 na 57 e R$ 15,74 na 97) não são arredondadas.",
  },
  {
    data: "2026-11-13",
    titulo: "Emendas: valor de cada lançamento financeiro pode ser corrigido",
    descricao: "Na aba Financeiro, o lápis de cada empenho, liquidação, pagamento ou anulação agora também altera o valor (além do número e da data). Para uma emenda que no IPM tem vários empenhos: corrija o valor do lançamento existente e use \"Registrar\" para incluir os demais. O sistema confere o saldo (empenho até o valor da emenda; pagamento até o empenhado) e a fase da emenda é atualizada sozinha. Para secretarias com permissão, a correção de valor vai para aprovação do gestor.",
  },
  {
    data: "2026-11-13",
    titulo: "Emendas: valor da emenda pode ser alterado no Remanejar",
    descricao: "O diálogo \"Remanejar\" agora tem o campo Valor (R$), junto com destinação, dotação e objeto. A mudança fica no histórico com ato e motivo. O sistema recusa valor abaixo do que já foi empenhado e valor que faça o vereador passar da cota. \"Corrigir cadastro\" continua permitindo ajustar o valor sem ato e motivo.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: \"Sem andamento\" volta a aparecer onde de fato não há nada",
    descricao: "Corrigido um efeito da mudança anterior: a fase da LOA e o parecer da secretaria (que são do exercício, não da emenda) passaram a contar como andamento e escondiam o aviso. Agora só lançamentos, fases preenchidas, termo e processo contam. O partido do Ricardo Geraldo Dias (PV) foi registrado.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: autor afastado sinalizado e dados do Município no exercício",
    descricao: "As emendas de vereador fora do exercício (como as do Ricardo Geraldo Dias, cassado e substituído pelo Alex Leite de Freitas) agora mostram o selo \"Autor afastado\" na lista e no detalhe e geram uma pendência de acompanhamento enquanto não forem concluídas; a emenda continua no nome do autor original. O nome e o CNPJ da Prefeitura passaram a constar no exercício 2026. A finalidade e as metas do plano de trabalho de 206 emendas foram preenchidas a partir do texto de cada descrição, e podem ser editadas.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: pendências refletem o que de fato existe e somem sozinhas",
    descricao: "O aviso \"Sem andamento\" deixou de aparecer em emendas que já têm empenho, pagamento, fase concluída ou processo, mesmo quando a etapa guardada ainda estava em \"Indicada\". Seis emendas totalmente empenhadas tiveram a etapa corrigida para \"Empenhada\" e a 191 (sem lançamentos) voltou para \"Indicada\". Nome do Município e unidade parlamentar passaram a constar no exercício. As pendências são recalculadas a cada abertura da tela: ao corrigir o dado, a pendência desaparece sem dar baixa.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: processo e contrato do Compras passam a valer como dado da emenda",
    descricao: "Sete emendas da Saúde ganharam o número do processo que estava nas notas da planilha, e 10 emendas foram ligadas ao processo correspondente no Compras. Quando a emenda está ligada a um processo do Compras, o número do processo e do contrato aparece no portal público e deixa de ser cobrado como pendente. Ao digitar o número do processo na execução, o gestor passa a ter o vínculo feito sozinho quando só existe um processo com aquele número.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: dados que já estavam no texto da emenda passaram a preencher o cadastro",
    descricao: "O CNPJ de 53 entidades beneficiárias (conferido pelos dígitos verificadores) e o endereço/localidade de 164 emendas foram lidos do texto das próprias emendas e gravados nos cadastros, deixando de aparecer como pendentes. Ao salvar uma emenda nova ou editada, o sistema faz isso sozinho, sem sobrescrever o que já foi preenchido. Unidades da própria prefeitura (postos, escolas, obras) foram reclassificadas como órgão público e não exigem CNPJ próprio.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: desfazer um andamento registrado por engano",
    descricao: "Na aba Andamentos, o gestor ganhou o botão \"Desfazer\" em cada andamento (com justificativa obrigatória). A etapa da emenda volta ao andamento anterior e a exclusão fica registrada no Histórico com quem fez e o motivo.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: substituição de vereador e cadastros com documento obrigatório",
    descricao: "Em Configurações › Vereadores, \"Substituir\" tira o vereador do exercício (as emendas dele continuam no nome dele) e cadastra quem entra, sem emendas e com partido. Nomes completos atualizados. Não é mais possível salvar vereador sem partido, entidade ou órgão sem CNPJ válido, nem pessoa física sem CPF válido (o CPF nunca aparece no portal público).",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: sem liquidação como fase, conclusão protegida e andamento alinhado ao Financeiro",
    descricao: "Liquidação e recebimento deixaram de ser fases da execução. \"Concluída\" só pode ser marcada quando todas as outras fases estão completas (tela e servidor). Registrar andamento de empenho ou pagamento agora exige o valor e lança o movimento na aba Financeiro (com bloqueio por saldo e aprovação para secretarias); a etapa avança sozinha quando o total fecha. Na lista do Financeiro, empenho é azul, pagamento verde e anulação âmbar.",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: três símbolos de andamento e botão para anular uma fase",
    descricao: "Bolinha verde com V = concluída (inclusive a presumida pela etapa atual); amarela vazada com V = parcial ou em andamento; triângulo amarelo vazado com ! = alerta; cinza tracejada = não iniciada. A linha fica amarela entre fases em andamento. Fases preenchidas por engano podem ser anuladas pelo gestor em Atualizar › \"Anular preenchimento e voltar a fase para pendente\" (a etapa da emenda é recalculada).",
  },
  {
    data: "2026-11-12",
    titulo: "Emendas: etapas no topo da emenda com bolinha verde, parcial e alerta",
    descricao: "A linha de etapas no alto da emenda agora usa as mesmas regras da aba Fases: bolinha verde com V (concluída), amarela vazada com V (parcial, com saldo a empenhar, liquidar ou pagar), triângulo amarelo vazado com ! (alerta) e linha amarela entre etapas parciais. Ao passar o mouse aparece o resumo da situação.",
  },
  {
    data: "2026-11-11",
    titulo: "Portal da Transparência: itens que só valem antes da execução",
    descricao: "Nas emendas ainda sem empenho ou pagamento, o portal público passou a mostrar \"Será divulgado antes da execução\" (em vez de \"Não informado\") para cronograma, gestor, termo, processo, contrato, extrato, banco e conta, anuência do SUS e plano de trabalho, conforme o art. 7º, § 2º, da IN TCE-MG 05/2025. Na tela de verificação, esses itens ficam como aviso informativo para as emendas sem execução e continuam como atenção para as já em execução.",
  },
  {
    data: "2026-11-12",
    titulo: "Portal da Transparência: brasão grande ao fundo do cabeçalho",
    descricao: "A marca-d'água do cabeçalho do portal público agora é o brasão em triângulo, grande e centralizado atrás dos dados, com folga acima e abaixo. No celular e no tablet ela também fica centralizada.",
  },
  {
    data: "2026-11-12",
    titulo: "Portal da Transparência: marca-d'água no formato do brasão",
    descricao: "A marca-d'água do cabeçalho do portal público deixou de ser um círculo e passou a mostrar o brasão em formato de triângulo, discreto ao fundo. No celular e no tablet ela fica centralizada, para continuar visível em telas menores.",
  },
  {
    data: "2026-11-12",
    titulo: "Portal da Transparência: brasão inteiro no cabeçalho",
    descricao: "A moldura do brasão no cabeçalho do portal público cortava a palavra \"Prefeitura\" da imagem. O brasão agora aparece completo, com margem interna e fundo no mesmo tom da imagem.",
  },
  {
    data: "2026-11-11",
    titulo: "Portal da Transparência: títulos em linguagem formal",
    descricao: "Os títulos dos blocos do portal público das emendas passaram a usar linguagem institucional: \"Situação da execução de cada emenda\", \"Forma de execução dos recursos\" e \"Execução financeira por vereador\".",
  },
  {
    data: "2026-11-11",
    titulo: "Portal da Transparência: cabeçalho com a identidade da Prefeitura",
    descricao: "O cabeçalho do portal público das emendas ganhou o azul-marinho da identidade da Prefeitura, o brasão e o nome em tamanho maior e enquadrados, e o brasão em marca-d'água discreta ao fundo, como no interior da plataforma. A caixinha de informações ao passar o mouse também ficou com fundo sólido, para ler melhor.",
  },
  {
    data: "2026-11-11",
    titulo: "Emendas: novo Portal da Transparência e publicação com verificação",
    descricao: "O portal público das emendas foi refeito: painel com o valor pago, empenhado e ainda não empenhado, gráficos por situação, tipo, vereador e secretaria e curva dos pagamentos, todos mudando com os filtros (também ao clicar nas barras), detalhe de cada emenda com os itens do art. 7º da IN TCE-MG 05/2025, guia de uso, tour guiado e boletim por e-mail com confirmação. Os dados se atualizam sozinhos, sem recarregar. Dentro do módulo, o item Portal público mostra os alertas antes de ir ao ar (críticos, de atenção e informativos, com o número de cada emenda) e só o administrador da Central decide quando publicar; o portal só exibe exercícios publicados.",
  },
  {
    data: "2026-11-11",
    titulo: "Emendas: fases parciais, alertas e balão de resumo",
    descricao: "Na linha do tempo da emenda, a bolinha verde com V é fase concluída; amarela vazada com V é parcial (ainda há saldo a empenhar, liquidar ou pagar); amarela vazada com ! é alerta. A linha entre fases parciais fica amarela e, ao passar o mouse, aparece o resumo da situação. Empenho, liquidação e pagamento acima do disponível são bloqueados, e o formulário mostra o saldo. Pagamento só fecha a fase quando cobre o valor da emenda.",
  },
  {
    data: "2026-11-11",
    titulo: "Emendas: processo de compra em uma fase só, e o vínculo junto das fases",
    descricao: "Na execução direta, DFD, preços, licitação e contrato viraram uma fase única, \"Processo de compra ou licitação\", que mostra só se o processo foi iniciado ou concluído. O campo para vincular o processo do Compras agora fica no topo da aba Fases, sem rolar a tela, e mostra apenas número, situação e o link para o Compras. Excluir um lançamento parcial também acerta a etapa.",
  },
  {
    data: "2026-11-11",
    titulo: "Emendas: fases acompanham o Compras e os lançamentos; telas se atualizam sozinhas",
    descricao: "Ao vincular o processo do Compras, as fases de demanda, preços, contratação e contrato da execução direta se preenchem sozinhas. Empenho, liquidação e pagamento só fecham a fase quando o total lançado cobre o valor disponível (parcial aparece em andamento). Painel de parceria e anexos agora seguem o tipo da emenda (direta, OSC ou ente). E todas as telas atualizam a cada 30 segundos e ao chegar um aviso, sem recarregar a página.",
  },
  {
    data: "2026-11-10",
    titulo: "Emendas: secretarias podem propor correção de empenho e pagamento",
    descricao: "Em Configurações › Exercício, o gestor liga ou desliga a opção. Ligada, a secretaria corrige número e data de empenhos, liquidações e pagamentos das emendas que edita, e a correção vai para Aprovações.",
  },
  {
    data: "2026-11-10",
    titulo: "Emendas: lançamentos de secretaria passam por aprovação",
    descricao: "Empenho, liquidação e pagamento lançados por perfil de secretaria agora vão para a tela Aprovações e só valem depois que o gestor aprova. Gestor e administrador continuam lançando direto.",
  },
  {
    data: "2026-11-10",
    titulo: "Sino de avisos sempre visível",
    descricao: "O painel de avisos e o aviso novo que aparece no canto abriam atrás dos cartões ou fora da tela. Agora ficam por cima de tudo, com fundo sólido.",
  },
  {
    data: "2026-11-10",
    titulo: "Emendas: histórico vira registro completo (quem, quando e o quê)",
    descricao: "A aba Histórico da emenda agora lista também lançamentos financeiros, andamentos, impedimentos e anexos criados, alterados ou excluídos, com nome de quem fez, data e hora. Nas exclusões aparece a justificativa informada.",
  },
  {
    data: "2026-11-10",
    titulo: "Emendas: excluir pagamento atualiza a linha do tempo",
    descricao: "Ao excluir o único empenho, liquidação ou pagamento de uma emenda, a etapa e a linha do tempo voltam ao que os lançamentos restantes comprovam, e o andamento correspondente sai do histórico. Antes a emenda continuava marcada como paga.",
  },
  {
    data: "2026-11-10",
    titulo: "Emendas: excluir lançamento e excluir emenda",
    descricao:
      "Na aba Financeiro, o ícone de lixeira exclui um empenho, liquidação ou pagamento lançado por engano. No fim da tela da emenda, “Excluir emenda” apaga a emenda inteira (exige digitar o número para confirmar). Só gestores; é obrigatório justificar (mínimo de 10 caracteres) e a justificativa fica guardada junto com o registro de auditoria.",
  },
  {
    data: "2026-11-07",
    titulo: "Imóveis: dados das planilhas de água e luz já cadastrados",
    descricao:
      "As planilhas de controle da Energisa e da COPASA de 2026 foram carregadas: 245 imóveis (nome do setor e endereço), 333 unidades de consumo e 2.620 contas, com as secretarias de cada aba. O que a planilha não traz ou deixa em dúvida (vínculo, contrato e aluguel, endereço genérico, possível imóvel repetido entre água e luz, conta zerada) aparece em Pendências como “Cadastro para revisar”. Abra o imóvel, corrija e marque “revisado” para o aviso sair.",
  },
  {
    data: "2026-11-06",
    titulo: "Endereço preenchido pelo CEP",
    descricao:
      "No cadastro de imóvel, digite o CEP e o endereço (rua, bairro, cidade e UF) é preenchido sozinho; depois é só informar o número e o complemento. O endereço continua editável à mão, e o CEP fica registrado no próprio texto do endereço.",
  },
  {
    data: "2026-11-06",
    titulo: "Novo módulo: Imóveis e Consumo",
    descricao:
      "Controle dos aluguéis, das contas de água e luz e da entrega dos imóveis de todas as secretarias, no mesmo lugar. O painel mostra o gasto mensal e o que precisa de atenção: contrato perto do fim, consumo ou valor fora do normal, conta sem lançamento ou em atraso, e imóvel entregue com água ou luz ainda ligada. As contas podem ser digitadas ou lidas de PDFs da concessionária; contrato, comprovante de troca de titularidade e laudo de vistoria também podem ser lidos de PDF para preencher o cadastro, sem guardar o arquivo. As planilhas de controle de água (COPASA) e luz (Energisa) também podem ser importadas: o sistema mostra o que vai entrar, você confere e importa. Imóveis agora têm vínculo (alugado, próprio ou cedido) e os alertas funcionam também só com o valor da conta. Os limites dos alertas são configuráveis. Cada secretaria vê só os próprios imóveis e pendências. Peça o acesso pelo card do módulo na tela inicial.",
  },
  {
    data: "2026-11-06",
    titulo: "Filtros mudam na hora, sem botão \"Filtrar\"",
    descricao:
      "Em Frotas (Notas de combustível, Veículos e Manutenção) e em Feedback, escolher uma opção na lista ou marcar uma caixa já atualiza a tela. Nos campos de busca, a lista atualiza assim que você para de digitar. O botão \"Limpar\" continua disponível. Em Emendas, a busca também passa a ficar no endereço da página, para compartilhar o resultado por link.",
  },
  {
    data: "2026-11-05",
    titulo: "Emendas: correção de empenho, liquidação e pagamento mais clara",
    descricao:
      "Na aba Financeiro, ao completar o número ou a data de um lançamento, o botão de salvar (✓) ganhou destaque, o aviso de erro aparece na própria linha e o sistema confirma que a gravação aconteceu de fato. O mesmo cuidado vale para as demais edições do módulo.",
  },
  {
    data: "2026-11-06",
    titulo: "Sua aparência acompanha você e o modo escuro ficou mais legível no celular",
    descricao:
      "O estilo (Apple ou Clássico) e o modo de cor agora ficam salvos na sua conta: ao entrar em outro computador ou navegador, a Central, o Compras e o Requerimentos já aparecem do jeito que você escolheu. No celular, o modo escuro ganhou cartões mais firmes, textos secundários mais claros e fontes pequenas maiores.",
  },
  {
    data: "2026-11-05",
    titulo: "Configurações iguais em todos os módulos e Aparência (Apple ou Clássico) em todos",
    descricao:
      "As Configurações do Frotas e do Emendas agora abrem num índice de cards, com abas para trocar de área, igual à Central, ao Compras e ao Requerimentos. O Requerimentos ganhou \"Minha conta\" (clique no seu nome) com aparência e troca de senha, e o Numera ganhou a janela Aparência no seu nome. Em todos os módulos você escolhe o estilo (Apple ou Clássico) e o modo de cor (automático, claro ou escuro).",
  },
  {
    data: "2026-11-05",
    titulo: "Visual Apple (vidro e cantos arredondados) em toda a Central",
    descricao:
      "A Central, o Emendas e o Frotas passaram para o mesmo visual do Compras: cartões em vidro translúcido, títulos grandes, botões em cápsula e o cabeçalho translúcido, mantendo a faixa de cor de cada módulo no topo. Quem preferir o visual anterior escolhe \"Clássico\" em Minha conta → Aparência.",
  },
  {
    data: "2026-11-05",
    titulo: "Modo escuro na Central, no Emendas e no Frotas",
    descricao:
      "Agora dá para trocar entre claro e escuro pelo botão de lua/sol no cabeçalho, igual ao Compras. Em Minha conta → Aparência você também pode deixar no Automático (segue o tema do aparelho). A escolha fica guardada neste navegador.",
  },
  {
    data: "2026-11-05",
    titulo: "O mesmo botão para voltar à Central em todos os módulos",
    descricao:
      "Compras, Requerimentos e Numera passaram a ter o mesmo cabeçalho da Central, do Emendas e do Frotas: o botão \"← Central\" à esquerda, ao lado do nome do módulo, e à direita os avisos, o feedback e a ajuda na mesma ordem e no mesmo tamanho, seguidos do seu nome e de Sair. No Compras saiu o segundo atalho para a Central que ficava na barra lateral.",
  },
  {
    data: "2026-11-05",
    titulo: "Frotas: OC, NF e Contabilidade em etapas, colunas da exportação e orçamentos em PDF",
    descricao:
      "Na manutenção, a OC, a NF da oficina e o envio à Contabilidade agora são registrados em etapas separadas, cada uma quando acontece (saíram \"OC enviada à secretaria\" e \"documentos de volta ao Frotas\"). Se a NF passar do valor da OC, o aviso fica na tela, na lista, no painel de alertas e na exportação até ser corrigido. Em Exportar → \"Escolher colunas…\" você decide o que aparece nos arquivos (tudo por padrão; a escolha fica guardada na sua conta e vale em qualquer computador). Novo: \"Importar PDFs\" cria vários orçamentos de uma vez, lendo o texto dos PDFs para você conferir (os PDFs não são guardados). Também corrigidas palavras cortadas nos menus de navegação do celular.",
  },
  {
    data: "2026-11-04",
    titulo: "Visual padronizado em todos os módulos",
    descricao:
      "O cabeçalho agora é o mesmo em toda a Central: brasão, botão “← Central” para voltar, o nome do módulo com a cor dele e, à direita, os mesmos botões de sino, feedback e ajuda (antes cada um tinha tamanho e forma diferentes). Botões e a navegação dos módulos seguem um só padrão, com a cor de cada módulo, foco visível para quem usa o teclado, alvos maiores no celular e um atalho “Pular para o conteúdo”. No celular, o painel de avisos e o menu Exportar não ficam mais cortados. Em Configurações → Usuários e acessos, o administrador aparece com acesso pleno a todos os módulos.",
  },
  {
    data: "2026-11-04",
    titulo: "Frotas: exportação e avisos no sino",
    descricao:
      "Em todas as telas do Frotas há um botão Exportar: veículos, NFs de combustível e manutenções saem em Excel, PDF ou CSV exatamente como estão filtrados na tela; a Análise exporta o custo × valor do veículo e o gasto por secretaria; o Painel exporta as pendências e a remessa à Contabilidade (a relação imprimível do que o Setor de Frotas tem em mãos para mandar). Além disso, o sino da Central passou a avisar o Setor de Frotas, toda manhã, de documento parado há muitos dias, orçamento esperando análise, secretaria sem NF na quinzena e veículo que passou do limite de custo em relação ao seu valor.",
  },
  {
    data: "2026-11-04",
    titulo: "Frotas: novo módulo para o Setor de Frotas",
    descricao:
      "O Frotas agora está na Central. Reúne o cadastro dos veículos (próprios, de convênio e alugados, com o valor da tabela FIPE), o controle das notas fiscais de combustível por secretaria a cada quinzena e a manutenção, do orçamento da secretaria à OC do IPM, à NF da oficina e à Contabilidade. O painel destaca o que está parado há muitos dias e a análise mostra quanto cada veículo gasta em manutenção em relação ao que vale. O acesso é concedido em Configurações → Usuários e acessos.",
  },
  {
    data: "2026-11-03",
    titulo: "Frotas e novos módulos a caminho",
    descricao: "A tela inicial passou a mostrar os próximos módulos: Frotas e mais um, ainda por anunciar. São só um aviso por enquanto, sem acesso.",
  },
  {
    data: "2026-11-03",
    titulo: "Nova tela inicial",
    descricao:
      "A tela inicial ganhou um visual novo: saudação pelo horário, cartões maiores com ícone e cor de cada módulo, aviso de pedidos de acesso mais claro e módulos sem acesso com botão de solicitar. O funcionamento é o mesmo.",
  },
  {
    data: "2026-11-03",
    titulo: "Emendas: mais filtros e pendências por assunto",
    descricao:
      "Novas pendências financeiras (empenho, liquidação e pagamento sem data, empenho sem número, pago sem empenho, paga sem pagamento lançado, sem beneficiário). Em Pendências: filtro por área, assunto com contagem e busca. Na lista: situação financeira (paga, paga em parte, empenhada sem pagamento, sem empenho, sem data de pagamento), pendência por assunto, Saúde e remanejadas. Os filtros valem também na exportação (exceto o de assunto da pendência).",
  },
  {
    data: "2026-11-03",
    titulo: "Texto ilegível no modo escuro do navegador",
    descricao:
      "A Central só tem tema claro e agora avisa isso ao navegador, que deixa de escurecer a página sozinho (o modo escuro automático do Chrome/Edge deixava as letras cinza muito claras). Se você usa uma extensão de modo escuro (como Dark Reader), desative-a para este site.",
  },
  {
    data: "2026-10-29",
    titulo: "Emendas: adequação à IN TCE-MG 05/2025 e à Recomendação MPC-MG 01/2025",
    descricao:
      "Nova tela Conformidade (item a item do art. 7º, por emenda) e novo bloco Transparência na emenda (localidade, cronograma previsto, finalidade e metas do plano de trabalho, anuência do SUS, identificador contábil). Novas pendências: publicidade incompleta (alta se já houve empenho ou pagamento — o sistema avisa, não bloqueia), conta repetida ou fora de banco oficial e relatório de gestão (prazo 30/06). Anexos ganharam Relatório de gestão e Anuência do SUS. O portal público passou a mostrar partido, descrição, localidade, gestor responsável, banco e conta, GND, datas de cada empenho/pagamento, processo e contrato, e a oferecer o plano de trabalho e os relatórios em PDF. Em Configurações › Exercício há os dados do Município e da Câmara.",
  },
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
