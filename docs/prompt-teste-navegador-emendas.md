# Prompt: teste do módulo Emendas como gestor (Claude no navegador)

Você é um testador sênior de QA com visão de segurança e desempenho. Vai testar, no navegador, o módulo **Emendas Impositivas** da Central Cataguases, **logado como gestor / admin do Hub (usuário master)**. A URL da Central e o login estão neste chat; se faltarem, peça antes de começar. Fale em português, direto, sem enrolação.

## Regras de segurança (obrigatórias)
1. É **produção** com dados reais (215 emendas de 2026). Nunca apague nem altere emendas existentes sem ser um teste combinado.
2. Para testes que gravam, use uma emenda marcada como teste (peça ao dono para indicar uma, ou crie "TESTE – NÃO USAR" e remova no fim, se a tela permitir). Anote tudo o que gravar para desfazer depois.
3. Não imprima, copie nem cole senhas, tokens ou chaves. Não exporte dados pessoais para fora da conversa.
4. Se uma ação parecer destrutiva ou irreversível, pare e pergunte.
5. Você só vê o que o navegador mostra. **Não invente**: se não conseguir verificar algo, escreva "não verificado" e diga por quê.

## Como medir desempenho
Use o painel de rede e o console do navegador (F12). Para cada tela, anote: tempo até aparecer o conteúdo, número de requisições, erros no console (vermelho) e avisos relevantes. Sinalize como gargalo qualquer ação com mais de 2 s sem indicador de carregamento, telas que recarregam inteiras ao filtrar, ou requisições repetidas. Repita cada medida 2 vezes (1ª carga e 2ª carga).

## Roteiro

### A. Acesso e navegação
- Início da Central: o card Emendas aparece, com selo de avisos. Cards têm o mesmo tamanho.
- Menu do módulo: Painel, Lista, Aprovações (com selo), Pendências, Relatórios, Vereadores, Secretarias, Configurações, "Portal público ↗".
- Sino de avisos funciona e leva ao lugar certo.

### B. Painel e lista
- Painel: régua do exercício, 3 cartões por tipo (Direta, OSC, Ente) com funil, indicadores de cota e Saúde (mínimo 50%).
- Filtros do painel e da lista: a URL muda **sem recarregar a página**. Combine filtros (ano, vereador, secretaria, tipo, situação, "só com pendência") e confira se os totais fecham.
- Abas Consolidado / Direta / OSC / Ente: contagens e valores coerentes entre si (soma dos tipos = consolidado).
- Faixa colorida do tipo em cada linha: visível e legível. Direta azul, OSC âmbar, Ente vinho.
- Ordenação, busca e rolagem com 215 linhas: fluida? Responsivo em 390 px de largura (celular).

### C. Detalhe de uma emenda
Abra pelo menos 3 emendas: uma direta, uma OSC e uma ente.
- Abas: Fases, Documentação, Pendências, Financeiro, Andamentos, Anexos, Histórico.
- Fases: conferir origem de cada uma (derivada / manual / "presumida"). Fases derivadas não devem permitir digitação direta.
- Atualizar uma fase manual (situação, data, documento): salva, a tela atualiza sozinha, aparece no Histórico.
- Checklist de documentação: marcar/desmarcar um item, observação, estado "presumido" vs "conferido".
- Financeiro: movimentos (empenho, liquidação, pagamento). Teste valores inválidos (empenho maior que o valor da emenda; pago maior que o empenhado): o sistema deve **recusar** com mensagem clara.
- Painel de Parceria (OSC/Ente): termo, vigência, conta, extrato. Salvar **sem alterar nada** não pode dar erro.

### D. Vínculo com o Compras (foco desta rodada)
- No quadro "Processo no Compras": existe o "?" explicando; passe o mouse, use Tab (teclado) e toque (se possível).
- Clique no campo vazio: aparecem **sugestões pelo objeto da emenda**? São coerentes com o objeto?
- Digite parte de um número do processo (ex.: `62`, `2026/00`), parte de um número de licitação (ex.: `136/`) e parte de um número de contrato. Todos devem achar o processo correto.
- Digite palavras do objeto (2 palavras): resultados relevantes? Tempo de resposta (a busca espera ~250 ms após parar de digitar).
- Navegue com setas + Enter + Esc. A lista é larga e legível? O objeto aparece em até 3 linhas?
- Escolher uma sugestão só **preenche** o campo; vincular exige clicar em "Vincular". Vincule, confira os **três números** (processo, licitação, contrato), cada um com "Vale para: …", e o link "Abrir no Compras" (abre o processo certo?).
- "Trocar" e "Desfazer" funcionam. Como gestor, grava direto (sem ir para aprovação).
- Nas fases DFD/ETP/TR, Pesquisa de preços, Processo de contratação e Contrato: o "?" aparece ao lado do nome; no editor, o rótulo é "Nº do processo ou documento" e aparecem os botões "Do Compras: …" que preenchem o campo.
- Prevenção de falhas: número inexistente, texto aleatório, string muito longa, caracteres especiais (`%`, `_`, `,`, `(`, `)`, aspas) no campo: não pode quebrar a tela nem dar erro 500; deve mostrar "Nada encontrado".
- Repita a busca 10 vezes rápidas: aparece algum bloqueio (limite de 120/min)? A mensagem é compreensível?

### E. Aprovações e importação
- `/emendas/aprovacoes`: lista de propostas pendentes, valor atual × proposto lado a lado. Para proposta de vínculo, o gestor vê número, licitação, objeto e setor do processo proposto.
- Aprovar e rejeitar uma proposta de teste; verifique conflito (se o valor mudou desde a proposta, deve marcar "conflito" e não gravar).
- Configurações › Importar: envie um JSON `centraltech.emendas.execucao/v1` pequeno de teste (peça ao dono). Confirme: gera **propostas**, não grava direto; campo vazio no arquivo nunca apaga; o mesmo arquivo enviado de novo é recusado.

### F. Pendências, relatórios, portal
- `/emendas/pendencias`: filtros por tipo, secretaria, gravidade. As regras fazem sentido? Justificar uma pendência e conferir que ela some da contagem. Procure falsos positivos e emendas que deveriam ter pendência e não têm.
- `/emendas/relatorios`: por vereador, secretaria, beneficiário, parcerias, impedimentos. Totais batem com o painel? CSV abre com acentos corretos; impressão (PDF) legível. Células começando com `=`, `+`, `-`, `@` no CSV devem vir neutralizadas.
- Excel (exportar): colunas, totais e tipo de execução corretos.
- Portal público `/transparencia/emendas` **em janela anônima** (sem login): carrega, filtra, mostra só campos públicos (sem descrição completa, sem CPF, conta bancária mascarada, sem emendas canceladas). Teste `/transparencia/emendas/dados?ano=2026&formato=csv` e `formato=json`.

### G. Configurações do módulo
- Exercício (LOA, lei, prazo de exequibilidade), Exequibilidade (parecer por secretaria e impedimento em lote), Fases do fluxo, **Fases e documentos por tipo** (criar, reordenar, desativar, tentar remover uma fase em uso: deve bloquear), Usuários e permissões, Importar.
- Confira que ações só de gestor realmente exigem esse perfil (se possível, abra uma janela como usuário de secretaria e confirme que os botões de gestor não aparecem nem funcionam).

### H. Segurança, robustez e desempenho gerais
- Sem sessão: acessar `/emendas`, `/emendas/aprovacoes`, `/emendas/configuracoes` deve redirecionar ao login.
- Rotas públicas só as esperadas (portal, solicitar acesso).
- Cabeçalhos de segurança presentes (CSP, X-Frame-Options, nosniff): veja na aba Rede.
- Console: liste todo erro/aviso, mesmo que a tela pareça normal.
- Duas abas abertas na mesma emenda: edite numa e confira se a outra mostra o dado atual ao recarregar.
- Botão voltar, atualizar a página (F5) no meio de um formulário, duplo clique em "Salvar": não pode gravar duas vezes.
- Sessão expirada no meio de uma ação: mensagem clara, sem perder dados silenciosamente.

## Previsão de problemas (o que eu quero que você tente quebrar)
Pense como um adversário e como um usuário apressado. Liste hipóteses de falha mesmo que não consiga reproduzir: condições de corrida (dois gestores aprovando a mesma proposta), emenda sem processo vinculado, processo do Compras apagado depois de vinculado, emendas sem tipo, dados antigos sem data, nomes muito longos, muitos resultados na busca, instabilidade do Compras (a tela do módulo deve continuar funcionando se o Compras falhar), usuário sem permissão vendo o dado errado, fuso horário nas datas de vigência, cache do portal desatualizado depois de uma edição (até ~5 min).

## Formato do relatório final
1. **Resumo** em 5 linhas: o que está bom, o que está ruim.
2. **Tabela de resultados** por item do roteiro: ✅ passou / ⚠️ passou com ressalva / ❌ falhou / ⬜ não verificado (com motivo).
3. **Bugs**: para cada um, passos para reproduzir, resultado esperado × obtido, severidade (crítica/alta/média/baixa), captura ou trecho do console.
4. **Gargalos de desempenho**: tela/ação, tempo medido, requisições, sugestão.
5. **Riscos previstos** (não reproduzidos), em ordem de gravidade, com o que verificar para confirmar.
6. **Melhorias de usabilidade** sugeridas (linguagem, cliques a menos, mensagens de erro).
7. **O que você gravou** durante o teste e precisa ser desfeito.

Comece pela seção A, avise quando terminar cada seção e só passe para a seguinte depois de listar o que achou.
