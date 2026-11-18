# Emendas Impositivas — guia de funcionalidades (material para o tutorial)

Registro do que o módulo faz e de como cada recurso é usado, em linguagem de uso (não de código). Serve de base para o tutorial.
Atualizado em 19/11/2026. Cada seção diz **quem usa**, **onde fica** e **como funciona**.

## 1. Quem acessa o quê

| Perfil | O que faz |
|---|---|
| **Administrador da Central** | Acesso total. Único que publica ou retira o Portal público. |
| **Gestor** | Cadastro, valores, remanejamento, conciliação, configurações e todas as rotinas do dia a dia. As decisões de encerramento das emendas, abertura/fechamento de exercício e importação de planilhas são do **gestor master** quando há um designado (ver abaixo). |
| **Gestor master** | Gestor designado pelo administrador da Central (Configurações › Usuários e permissões). Decide o encerramento das emendas, a abertura e o fechamento do exercício e as importações. Enquanto nenhum master for designado, todos os gestores seguem decidindo; depois que há um, só ele e o administrador. |
| **Administrador de secretaria / Operador** | Registra a execução das emendas da própria secretaria. Mudanças em dado já preenchido viram **proposta** que o gestor aprova. |
| **Consulta** | Só lê, nas secretarias liberadas. |

Cada pessoa só enxerga as emendas das secretarias a que tem permissão (a regra está no banco, não só na tela).

## 2. Exercício (ano) — seletor global

- Acima de todas as telas do módulo há o seletor **Exercício**. Escolher 2026 ou 2027 muda Painel, Emendas, Pendências, Panorama, Relatórios, Portal e Configurações de uma vez.
- A escolha fica guardada: abrir outra tela mantém o ano. Ao entrar de novo, o módulo abre o exercício aberto mais recente.
- **Exercício encerrado:** aparece com o aviso "encerrado" e fica protegido. Só se lançam **pagamentos e anulações de emendas inscritas em restos a pagar**; empenhos, novas emendas, remanejamentos, cancelamentos e andamentos exigem **reabrir** o exercício (Configurações › Exercício, pelo gestor master ou administrador).
- Cadastros que valem para todos os anos: vereadores, secretarias, beneficiários, catálogos de fases e documentos. O que é do ano: cota por vereador, percentual mínimo da Saúde, LOA, prazo de exequibilidade, dados de publicação.

## 3. Painel

Visão do exercício: régua do ano, um cartão por tipo de execução (direta, repasse a OSC, repasse a ente), gráficos com filtro cruzado (clicar numa barra filtra o restante) e o resumo do **Panorama da execução** com link.

## 4. Emendas (lista e detalhe)

- **Lista:** abas Consolidado / Direta / OSC / Ente, filtros que valem na hora (sem botão "filtrar"), faixa colorida pelo tipo, selo da categoria do beneficiário. Exporta Excel e PDF com os mesmos filtros.
- **Detalhe da emenda:** abas **Fases**, **Documentação**, **Pendências**, **Financeiro**, **Andamentos** e **Histórico**.
- **Tipos de execução:** *direta* (a Prefeitura compra/executa), *OSC* (repasse a organização da sociedade civil por termo de fomento) e *ente* (repasse a hospital, consórcio, outro ente). Cada tipo tem o seu caminho de fases e a sua lista de documentos.
- **Nova emenda:** o beneficiário escolhido sugere o tipo de execução e o instrumento (termo ou convênio); a pessoa pode trocar.

## 5. Fases (andamento)

- Cada fase é preenchida por **uma única fonte**: LOA vem do exercício; análise de exequibilidade vem do parecer da secretaria; empenho e pagamento vêm dos lançamentos financeiros; termo e extrato vêm da aba de parceria. Nada é digitado duas vezes.
- Fases manuais (ex.: pesquisa de preços, contratação) são marcadas como concluídas na própria aba, com data e documento de referência. Dá para ligar o **processo do Compras** (busca por número ou palavras do objeto) e ver status, setor e contrato sem sair da emenda.
- O fluxo e os documentos de cada tipo são editáveis em Configurações (Fases do fluxo; Fases e documentos por tipo).

## 6. Financeiro

- **Cinco cartões:** Valor da emenda, Empenhado, Pago, A pagar (empenhado − pago) e Sem empenhar (valor − empenhado; vira "Acima da emenda" se o empenho passar do valor). Cada cartão tem um **?** com a explicação.
- **Lançar movimento:** empenho, pagamento, anulação de empenho. Os valores são sempre os do IPM, **exatos, sem arredondamento**; o banco barra pago maior que empenhado e empenho acima da emenda (sem fonte informada).
- A liquidação não é uma fase: o controle contábil é do IPM.

### Conciliação com o IPM e encerramento (botões sob os cartões)

Os botões só aparecem para o gestor e **somente quando o valor correspondente existe**:

| Situação | Cartão | Botão | O que acontece |
|---|---|---|---|
| Sobrou valor da emenda sem empenhar | Sem empenhar | **Registrar saldo e situação da emenda** | Escolhe *cumprida com economia* ou *não cumprida*; justificativa opcional. O saldo não executado é registrado junto. |
| Sobrou empenho sem pagar | A pagar | **Inscrever em restos a pagar** | O empenho não pago passa para o exercício seguinte. |
| Sobrou empenho sem pagar e a emenda terminou | A pagar | **Solicitar anulação do saldo** | Registra data e ofício; a Contabilidade anula no IPM; depois lança-se a "Anulação de empenho" e o aviso some. |
| Tudo empenhado e pago | Pago | **Marcar emenda como cumprida** | Exige o comprovante (ver abaixo). |
| Empenhado acima do valor da emenda | Acima da emenda | **Informar fonte do excesso** | A fonte de recurso é obrigatória. |

### Situação de encerramento (um campo só)

- **Cumprida:** objeto entregue integralmente.
- **Cumprida com economia** (no repasse: **com devolução de saldo**): objeto entregue gastando menos. O valor não empenhado volta ao caixa da Prefeitura e **a emenda continua contando como cumprida**. No repasse pode-se registrar a devolução (valor, data, comprovante).
- **Não cumprida:** impedimento ou desistência.
- **Em restos a pagar:** vale **só para valor já empenhado e não pago** (Lei 4.320, art. 36). Valor que nunca foi empenhado não vira restos a pagar. Quando o restos a pagar é todo pago, a emenda passa sozinha a cumprida.
- **Comprovante para marcar como cumprida:** execução direta = **nota fiscal com o atesto de recebimento**; repasse = **prestação de contas**. O arquivo fica no Drive; cola-se o link na janela (ou antes, na aba Documentação). O documento é interno e nunca vai ao portal.
- Qualquer registro pode ser desfeito pelo gestor ("Desfazer"); tudo fica na auditoria.

## 7. Documentação

- Documentos ficam no **Google Drive**; a plataforma guarda só o endereço do arquivo. Cola-se o link do arquivo (nunca da pasta).
- A lista mostra o que a lei exige para o tipo da emenda (termo, plano de trabalho, extrato publicado, relatório de gestão, anuência do SUS na saúde; convênio no caso de consórcio) com o estado *disponível* ou *pendente*.
- Ao ligar termo, extrato ou convênio, dá para escolher o mesmo PDF para a plataforma **ler o texto e preencher** o número do termo e a data de publicação (só campo vazio, só se inequívoco; o PDF não é guardado). Problemas (arquivo ilegível, repetido, dado divergente) aparecem como aviso ao lado do documento.
- A **ficha** (o "olho") é montada com os dados da emenda, para conferir o documento sem abrir o PDF.
- A mesma aba mostra a **comprovação do cumprimento** (nota fiscal ou prestação de contas).

## 8. Pendências

- Tela `/emendas/pendencias`: painel com pizza e ranking por área, gravidade, assunto, secretaria, tipo e documentos faltando. Clicar numa fatia filtra a lista.
- Exemplos de pendência: impedimento aberto, termo sem extrato, parceria sem conta específica, vigência vencida, emenda sem andamento, empenho sem publicidade completa, saldo a registrar, empenho a anular, excesso sem fonte.
- Cada pendência pode ser **justificada**; a justificativa vale enquanto o dado não mudar. Exporta Excel e PDF.

## 9. Conformidade (IN TCE-MG 05/2025)

Resumo por item do art. 7º (os dados de publicidade que cada emenda precisa ter) e lista das emendas que ainda não cumprem. A plataforma **alerta, não bloqueia**.

## 10. Panorama da execução

- Cenário global do exercício, para acompanhar **o ano todo**. Cada **cartão é um filtro**: clicar mostra as emendas do número e clicar de novo limpa.
- Grupos de cartões: **Visão geral** (valor, empenhado, pago), **O que falta executar** (empenho não pago; sem empenho em andamento; sem empenho com a emenda encerrada), **Situação das emendas** (cumpridas, cumpridas com economia/devolução, não cumpridas, em restos a pagar, sem situação definida), **Conciliação com o IPM** (empenho a anular, devoluções, acima da emenda).
- Quadros por secretaria, por vereador e por tipo de execução; filtros de secretaria e tipo valem para tudo.
- Bloco **Restos a pagar de exercícios anteriores** quando se olha um ano seguinte.
- **Relatório completo** em Excel (abas Resumo, Por secretaria, Por vereador, Por tipo, Por emenda, Conciliação IPM e Restos de anos anteriores) e **resumo em PDF**, para prestação de contas e conciliação com a Contabilidade.

## 11. Aprovações

Quando uma secretaria muda um dado já preenchido, nasce uma **proposta**. O gestor decide em *Aprovações*; se o dado mudou desde a proposta, ela vai para *conflito* e nada é gravado. A secretaria acompanha as suas em *Minhas propostas*.

## 12. Relatórios

Por vereador, por secretaria, por beneficiário, parcerias/prestação de contas e impedimentos abertos. Imprime (salvar como PDF), exporta CSV e PDF. São dados de apoio; o envio oficial ao TCE-MG segue o sistema deles.

## 13. Portal da Transparência (público, sem login)

- Mostra as emendas publicadas do exercício com filtros, gráficos e detalhe, e oferece **dados abertos** (CSV/JSON) e **boletim por e-mail**.
- **Só o administrador da Central publica.** Antes de publicar, a plataforma verifica os dados que vão ao ar e mostra alertas críticos (ex.: CPF em texto público, pago maior que empenhado); publicar com crítico exige marcar ciência.
- Nunca aparecem CPF, endereço de pessoa física, observações internas, conta completa nem documentos internos (inclui nota fiscal e prestação de contas).
- A situação de encerramento **não** é mostrada no portal (não há exigência legal identificada).

## 14. Configurações (gestor)

Exercício (cota, LOA, prazo, dados de publicação, permissão de lançamento pela secretaria), Fases do fluxo, Fases e documentos por tipo, Exequibilidade (parecer por secretaria e impedimento em lote), Beneficiários (com **leitura automática** de documento: nome, CNPJ, endereço, categoria), Vereadores, Secretarias, Usuários e permissões, Importar planilha.

## 15. Rotinas automáticas e avisos

- **Sino de avisos** ao vivo para gestores: andamentos, impedimentos, movimentos financeiros.
- **Boletim do portal** por e-mail (diário, só quando algo mudou).
- Tudo que é gravado fica na **auditoria** (quem, quando, o que mudou) e aparece no histórico da emenda.

## 16. Abrir um novo exercício (Configurações › Exercício)

O **Assistente do exercício** mostra, para o ano selecionado, o que falta para ele estar pronto e leva à tela onde cada passo se resolve:

1. **Exercício criado.** Em *Abrir um novo exercício* escolhe-se o ano e de qual ano **copiar** a cota por vereador, o mínimo da Saúde, a RCL e os dados do Município. LOA, lei, prazo de exequibilidade e a publicação do portal **não** são copiados (são de cada ano).
2. **Parâmetros do ano:** cota, data da LOA, nº da lei e prazo de exequibilidade (os quadros logo abaixo).
3. **Vereadores:** o cadastro vale para todos os anos; ajusta-se quem saiu ou entrou em *Vereadores*.
4. **Emendas aprovadas:** *Importar planilha*. A prévia confere vereadores, cota e destinações antes de gravar; reimportar não duplica.
5. **Ajustes depois da exequibilidade:** *Importar ajustes* (seção "Ajustes depois da exequibilidade", em Importar). Envia-se a planilha atualizada; a plataforma **compara com o cadastro e mostra só o que mudou** (valor, objeto, ficha/dotação, destinação), as emendas novas e as que sumiram da planilha. O gestor marca o que aplicar, informa o **ato** e o **motivo**; cada mudança vira **remanejamento** no histórico da emenda. Célula vazia na planilha nunca apaga um dado.
6. **Fechar o exercício anterior:** mostra quantas emendas do ano anterior ainda estão **sem situação de encerramento** (com link para vê-las no Panorama). Para fechar com pendências é preciso escrever uma justificativa. Fechar **não impede** pagar restos a pagar. *Reabrir* desfaz.

## 17. Cadastro de entidades sem digitação

Em *Configurações › Beneficiários › Novo beneficiário* há duas ajudas:
- **Preencher pelo CNPJ:** digitando os 14 números, a plataforma consulta a Receita (BrasilAPI) e preenche nome, endereço, e-mail, telefone, representante (primeiro dirigente do quadro societário, sem CPF) e **categoria** (pela natureza jurídica). Avisa se a situação cadastral não é "ativa" e se o CNPJ já está cadastrado. A pessoa confere e salva.
- **Importar de um documento (PDF):** lê cartão do CNPJ, estatuto ou plano de trabalho. O arquivo não é guardado.

## 18. Em construção (combinado, ainda não feito)

- Nada pendente do plano combinado até aqui. Novas ideias entram nesta lista.
