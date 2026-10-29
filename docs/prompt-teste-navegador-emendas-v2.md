# Prompt v2: reteste do módulo Emendas como gestor (Claude no navegador)

Você é um testador sênior de QA com visão de segurança, desempenho e conformidade legal. Vai testar, no navegador, o módulo **Emendas Impositivas** da Central Cataguases, **logado como gestor / admin do Hub (usuário master)**. A URL da Central e o login estão neste chat; se faltarem, peça antes de começar. Fale em português, direto.

Esta é a **segunda rodada**. A primeira cobriu só a navegação e parte do painel; as seções C a H ficaram **sem verificar** porque captura de tela, clique e JavaScript da extensão falharam. **Antes de começar, confirme que consegue clicar, digitar e ler o console e a aba Rede.** Se não conseguir, diga logo, o que ficará sem verificação, e ainda assim execute tudo o que for possível por leitura da página e navegação por URL.

## Regras de segurança (obrigatórias)
1. É **produção** com dados reais (215 emendas de 2026). Nunca apague nem altere emendas existentes, a menos que seja uma emenda de teste combinada com o dono.
2. Para testes que gravam, use uma emenda "TESTE – NÃO USAR" (peça ao dono para criar uma direta, uma OSC e uma ente, ou use as indicadas por ele). Anote tudo o que gravar, para desfazer no fim.
3. Não imprima, copie nem cole senhas, tokens ou chaves. Não leve dados pessoais para fora da conversa.
4. Se uma ação parecer destrutiva ou irreversível, pare e pergunte.
5. **Não invente.** Se não conseguir verificar algo, escreva "não verificado" e diga por quê.

## Situação conhecida (para você comparar)
- Exercício 2026: 215 emendas, R$ 5.157.490,05 indicados; tipos 85 direta + 109 OSC + 21 ente; 179 com pendência antes da adequação à IN 05/2025 (agora devem ser mais, pois entraram pendências novas).
- Pagos: R$ 1.841.196,02 (68 emendas); a curva de pagamentos mostra menos porque 4 pagamentos não têm data (aviso amarelo explica).
- Beneficiários sem CNPJ: 215. Vereadores sem partido: 15. Planos de trabalho anexados: 0. Isso deve aparecer como "faltando" na tela de Conformidade, e está correto.
- Lentidão relatada na rodada 1: Painel > 10 s e Lista ~30 s. O banco responde em < 1 s; a causa não foi achada. O servidor agora registra tempos; sua medição precisa ser **precisa** (veja "Como medir").

## Como medir desempenho
Aba Rede e Console (F12). Para cada tela abaixo, em **carga fria** (primeira vez, com cache desabilitado) e **carga quente** (segunda vez): tempo até o conteúdo útil aparecer, tempo do documento principal (TTFB), número de requisições, tamanho transferido, erros em vermelho. Anote o horário exato (hh:mm:ss) de cada medição, pois os logs do servidor guardam só 1 hora e serão comparados depois. Telas: Painel, Lista, Pendências, Conformidade, detalhe de uma emenda, Relatórios, portal público.

## Roteiro

### A. Acesso e navegação
- Menu do módulo: Painel, Emendas, Pendências, **Conformidade (novo)**, Aprovações, Relatórios, Vereadores, Secretarias, Configurações, "Portal público ↗". Cards da Central com o mesmo tamanho; sino funcionando.

### B. Painel e lista
- Totais coerentes (tipos somam 215; funil soma 215). Filtros mudam a URL sem recarregar. Abas Consolidado/Direta/OSC/Ente. Faixa colorida do tipo visível. Mostrar mais 25 funciona.
- Selo de pendências diz "N pendência(s)". Nome do vereador igual na lista e no filtro.
- Painel: aviso amarelo sobre pagamentos sem data; "Na Saúde" com "?" e base legal; nota no cartão "Composição".
- **Botão único "Exportar"** na lista (Excel e PDF): baixa os dois e abre os arquivos? O PDF respeita os filtros e tem total?

### C. Detalhe de uma emenda (uma direta, uma OSC, uma ente)
- Abas Fases, Documentação, Pendências, Financeiro, Andamentos, Anexos, Histórico. Fases derivadas não editáveis; atualizar fase manual grava e aparece no Histórico.
- "Base legal:" aparece em fases, documentos, pendências e diálogos (impedimento, lançar movimento).
- Financeiro: valores inválidos (empenho > valor; pago > empenhado) são **recusados** com mensagem clara.
- Painel de Parceria (OSC/ente): salvar **sem alterar nada** não pode dar erro.
- **Bloco "Transparência (IN TCE-MG 05/2025)" (novo)**: mostra "X de Y itens" e a lista do que falta; "Editar" abre o formulário (localidade, início/término previstos, finalidade e metas, outras fontes, identificador contábil, fonte de recurso; anuência do SUS só se a emenda for de Saúde). Salvar na emenda de teste funciona e o contador atualiza sozinho. Datas invertidas e valor inválido são recusados.
- **Anexos**: tipos novos "Plano de trabalho", "Relatório de gestão" (pede o ano), "Anuência do SUS". Anexar um PDF pequeno de teste na emenda de teste, baixar, remover.

### D. Vínculo com o Compras
- "?" explicativo; campo mostra sugestões pelo objeto da emenda; busca por parte do número do processo, da licitação e do contrato; setas + Enter + Esc; lista larga e legível.
- Vincular, ver os **três números** (processo, licitação, contrato) com "Vale para: …", link "Abrir no Compras", "Trocar", "Desfazer".
- Nas fases DFD/ETP/TR, Pesquisa de preços, Contratação e Contrato: "?" e botões "Do Compras" preenchem o campo.
- Entradas hostis (`%`, `_`, `,`, `(`, aspas, texto enorme) não quebram nada; 10 buscas rápidas seguidas não dão erro.

### E. Aprovações e importação
- Tela de Aprovações (valor atual × proposto; processo proposto com número/objeto). Aprovar/rejeitar proposta de teste; conflito é detectado.
- Importar um JSON `centraltech.emendas.execucao/v1` de teste (peça ao dono): gera **propostas**, não grava direto; o mesmo arquivo enviado de novo é recusado.

### F. Pendências, conformidade, relatórios, portal
- **Pendências**: filtros (tipo, gravidade, secretaria, assunto) mudam a URL; "Mostrar justificadas" funciona; cartão traz "Abrir emenda nº" e "Base legal". Pendências novas aparecem: "Publicidade incompleta" (alta nas emendas com empenho/pagamento), "Objeto pouco descritivo", conta repetida / fora de banco oficial. Confira se a gravidade está coerente e se há **falsos positivos**.
- **Conformidade (novo, `/emendas/conformidade`)**: resumo por item (I a XVII e art. 5º); os números fazem sentido com a realidade conhecida (CNPJ 0 de 215, partido 0 de 15…)? Clicar no número de "Faltam" filtra a lista; "só as já empenhadas ou pagas" funciona; clicar numa emenda abre o detalhe.
- **Relatórios**: botão único "Exportar" em cada tabela (PDF e CSV) e no topo ("Todos em PDF", imprimir). Os PDFs abrem, têm cabeçalho repetido, total e rodapé de página, e acentos corretos. CSV: células iniciadas por `=`, `+`, `-`, `@` vêm neutralizadas.
- **Portal público em janela anônima**: `/transparencia/emendas`. Abra 3 emendas e confira os campos: descrição, vereador (com partido, se houver), localidade, gestor responsável, **banco e conta completos**, GND/categoria, datas de cada empenho/pagamento, processo/contrato, cronograma, anuência SUS, plano de trabalho e relatórios em PDF (apenas se anexados), "Documentos" quando não há. Itens não informados **não** aparecem. Rodapé fala "conforme o art. 7º da IN" e **não** afirma conformidade total.
- Teste o link público de documento (`/transparencia/emendas/documento/<id>`): com o PDF de teste anexado como plano de trabalho abre; com outro tipo de anexo (ex.: nota fiscal) deve dar 404. Dados abertos: `.../dados?ano=2026&formato=csv` e `formato=json` (conferem colunas novas, sem CPF nem endereços).

### G. Configurações do módulo
- Exercício (inclui **Dados de publicação**: Município, CNPJ, unidade parlamentar; validação de CNPJ), Exequibilidade (parecer + impedimento em lote), Fases do fluxo, Fases e documentos por tipo (remover fase em uso deve bloquear), Vereadores (partido), Beneficiários (CNPJ), Usuários e permissões, Importar.
- Se possível, abra outra janela com um usuário de secretaria e confirme que ações exclusivas do gestor não aparecem nem funcionam, e que a secretaria só enxerga o que deve.

### H. Segurança e robustez
- Sem sessão: `/emendas`, `/emendas/aprovacoes`, `/emendas/conformidade`, `/emendas/configuracoes` redirecionam ao login. Rotas públicas só as esperadas (portal, solicitar acesso).
- Cabeçalhos de segurança presentes (CSP, X-Frame-Options, nosniff).
- Console: liste todo erro/aviso, mesmo com a tela normal.
- Duplo clique em "Salvar" não grava duas vezes; F5 no meio de um formulário; sessão expirada dá mensagem clara; duas abas na mesma emenda.

## Tente quebrar
Condições de corrida (dois gestores aprovando a mesma proposta), emenda sem processo vinculado, processo do Compras removido depois de vinculado, Compras indisponível (a tela do módulo deve continuar), emendas sem tipo, nomes muito longos, usuário sem permissão vendo dado errado, fuso nas datas de vigência, cache do portal desatualizado depois de uma edição (até ~5 min), PDF com texto muito longo ou caracteres especiais, plano de trabalho anexado com nome estranho.

## Formato do relatório final
1. **Resumo** em 5 linhas.
2. **Tabela por item do roteiro**: ✅ passou / ⚠️ com ressalva / ❌ falhou / ⬜ não verificado (com motivo).
3. **Bugs**: passos, esperado × obtido, severidade, console/rede.
4. **Desempenho**: tabela com tela, carga fria/quente, TTFB, requisições, horário. Aponte a(s) tela(s) acima de 2 s.
5. **Riscos previstos** (não reproduzidos), por gravidade.
6. **Conformidade**: itens da IN 05/2025 que você achou publicados/faltando no portal e na tela de Conformidade; qualquer dado que **não deveria** estar público (CPF, endereço de pessoa física, anexo de tipo não permitido).
7. **Usabilidade**: sugestões curtas.
8. **O que você gravou** durante o teste e precisa ser desfeito.

Comece pelo item "confirmar que consegue clicar, digitar e ler console/rede". Avise ao concluir cada seção.
