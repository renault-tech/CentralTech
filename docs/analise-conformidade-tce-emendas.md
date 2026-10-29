# Análise de conformidade — Emendas × IN TCE-MG 05/2025 e Recomendação MPC-MG 01/2025

Data da análise: 29/10/2026. Documentos lidos por inteiro: Instrução Normativa TCE-MG nº 05/2025 (10/12/2025) e Recomendação MPC-MG nº 01/2025 (18/12/2025). Base de comparação: o módulo Emendas e o portal público (`/transparencia/emendas`) como estão na `main`, mais uma conferência dos dados reais de 2026 no banco (215 emendas).

> Esta é uma análise técnica do sistema contra o texto das duas normas. Interpretação jurídica (o que se aplica a emendas de **vereadores** municipais, prazos, quem responde) deve ser confirmada pela Procuradoria/controle interno. Onde há dúvida de interpretação, está marcado.

## 1. O que as normas exigem (resumo)

**IN 05/2025 (arts. 4º a 8º)** — para emendas estaduais e municipais incluídas nas leis orçamentárias **a partir de 2026**:
- Rastreabilidade em **todas as etapas** do orçamento até o beneficiário final; **identificadores contábeis específicos** por emenda (fonte de recurso/código/identificador único) associando cada despesa à emenda (arts. 4º e 5º).
- **Conta específica por transferência**, em banco oficial, sem saques em espécie, sem contas de passagem (art. 6º).
- **Publicação em meio digital de acesso público** de 17 elementos (art. 7º, I a XVII), **antes** da execução orçamentária e financeira (§ 2º). Inclui Plano de Trabalho e Relatório de Gestão (este até 30/06 do ano seguinte e atualizado todo 30/06 até o fim).
- Providências do ente (art. 8º): adaptar sistemas, ato normativo próprio do ciclo de fiscalização e prestação de contas, auditorias do controle interno, respeito aos percentuais da CF art. 166 §§ 9º e 9º-A (ADIs 6670 e 7493), **suspender a execução** de emendas se a conformidade não for demonstrada, e divulgar transferências fundo a fundo.

**Recomendação MPC-MG 01/2025** — dirigida a Prefeitos e Presidentes de Câmara: concentrar informações em portal/sistema equivalente (ou usar o Portal de Emendas do TCE-MG), exigir **Plano de Trabalho prévio**, contas específicas por emenda, controle interno, identificadores contábeis, e **informar ao TCE-MG até 01/02/2026** (mesmo se não houver emendas). Sem implantação: **ato administrativo suspendendo a execução** das emendas (art. 4º, § 1º). Emendas de saúde: aprovadas pelas instâncias de governança do SUS (art. 2º, § 3º).

## 2. Art. 7º da IN — item a item (o que o sistema tem)

Legenda: ✅ atende · 🟡 atende em parte · ❌ não atende · ❔ depende de interpretação.

| Item | Exigência | Situação | O que existe hoje / o que falta |
|---|---|---|---|
| I | Parlamentar: nome completo, partido, unidade parlamentar | 🟡 | Portal mostra o nome. **Partido** existe no cadastro (`vereadores.partido`) mas está **vazio para os 15 vereadores** e o portal não o exibe. Falta "unidade parlamentar" (Câmara Municipal) e emendas de comissão/bancada (hoje só individuais). |
| II | Código único da emenda ligado ao ato normativo (LOA/crédito) | 🟡 | Tem nº da emenda e ano. **Não exibe o nº da LOA** (existe `exercicios.numero_lei_loa`, não preenchido/mostrado) nem crédito adicional. |
| III | Objeto detalhado: ação/projeto/atividade e finalidade específica | 🟡 | Portal mostra só o **objeto resumido** e a funcional programática. A **descrição** (preenchida nas 215) foi deliberadamente escondida. A IN pede descrição detalhada → publicar. |
| IV | Valor alocado | ✅ | Publicado. |
| V | Órgão/entidade executora ou beneficiário final | ✅ | Secretaria, unidade orçamentária e beneficiário publicados. |
| VI | Localidade beneficiada | ❌ | **Não existe campo** para município/bairro/localidade. |
| VII | Cronograma: início e término previstos, etapas | 🟡 | Só vigência (início/fim) das parcerias (65 de 90 com dado). **Execução direta não tem cronograma** (datas previstas). |
| VIII | Instrumentos (convênio, termo, contrato) e **nº do processo administrativo** | 🟡 | Portal mostra o termo. **Não mostra** o processo administrativo/licitatório nem o contrato, embora o sistema já tenha o vínculo com o Compras (`processo_id`, `numero_contrato`). Hoje só 2 emendas têm processo informado, **nenhuma com vínculo** ao Compras. |
| IX | **Plano de Trabalho** (objeto, finalidade, metas; estimativa de recursos por fonte; classificação corrente × capital; prazo e cronograma) | ❌ | O Plano aparece só como **fase** no fluxo. **Não há campo estruturado nem anexo** (a tabela de documentos está **vazia**), nem publicação. É a maior lacuna. |
| X | **Relatório de gestão** (objeto; execução orçamentária e financeira; relação de licitações e contratos), até 30/06 do ano seguinte, atualizado anualmente | ❌ | **Não existe** o conceito, nem prazo, nem alerta, nem publicação. |
| XI/XII | Recebedor + **CNPJ**; Município/Estado + CNPJ | ❌/🟡 | Beneficiário publicado, mas **CNPJ vazio nos 215 beneficiários**. Não há CNPJ do Município como recebedor/concedente. |
| XIII | Data(s) de disponibilização do recurso | 🟡 | Portal mostra só o **último pagamento**. Faltam as datas de cada empenho/repasse. |
| XIV | **Gestor responsável (nome completo)** | ❌ | Existe (`gestor_pmc` 64 e `gestor_osc` 60 preenchidos) mas **foi retirado do portal** por cautela LGPD. A IN exige publicar. |
| XV | GND | 🟡 | A natureza da despesa é publicada; o **GND não é exibido explicitamente** (dá para derivar do 2º dígito da natureza). |
| XVI | **Banco e conta corrente** (nome da instituição e número da conta) | ❌ | O portal **mascara a conta** (últimos 4 dígitos) e não mostra o banco; o cadastro tem um campo único de texto livre. A IN pede a conta e o banco. |
| XVII | Anuência prévia do SUS (sim/não) | ❌ | **Não existe** campo. 80 das 215 emendas são de saúde. |
| § 1º | Relatório de gestão: prazo 30/06 e atualização anual | ❌ | Sem controle de prazo. |
| § 2º | Informações publicadas **antes** da execução | 🟡 | O portal publica a emenda desde a indicação, mas **não verifica** se os 17 itens estão completos antes do empenho/pagamento. |

## 3. Rastreabilidade e controle (arts. 4º a 6º da IN; art. 2º da Recomendação)

| Exigência | Situação | Comentário |
|---|---|---|
| Identificador contábil por emenda (fonte de recurso / código único) e ligação despesa × emenda (arts. 4º-5º; Rec. IX) | ❌ | O sistema tem a "ficha" (dotação) e o nº da emenda, mas **não o identificador/fonte usado na contabilidade**, nem o exige no empenho. É coordenação com a Contabilidade (Portaria STN/MF 1.307/2024). |
| Conta específica por emenda, banco oficial, sem contas de passagem (art. 6º) | 🟡 | Há a pendência "parceria sem conta" e o campo conta. **Não valida** banco oficial, **não impede a mesma conta em duas emendas** (conta de passagem) e **só 60 de 90** execuções têm conta informada. Sem campo estruturado de banco/agência/conta. |
| Registro da receita por classificação do órgão central (art. 8º IX) | ❔ | Matéria da Contabilidade; só se aplica se o município **recebe** recursos de emenda de outro ente. |
| OPP / Transferegov (art. 8º VII; Rec. VII) | ❔ | Refere-se a **transferências especiais** (emendas "PIX" de outro ente). Não parece aplicável a emendas de vereadores do próprio município; confirmar. |
| Fundo a fundo (art. 8º XII; Rec. II) | ❔ | Idem: aplicável a transferências recebidas; o módulo trata um Fundo de Saúde só como unidade orçamentária. |
| Ciclo de fiscalização e aprovação das contas (art. 8º IV; Rec. art. 3º) | 🟡 | Exige **ato normativo próprio** (decreto/portaria) — fora do sistema. O sistema só tem a fase "Prestação de contas"; **não registra análise/aprovação/reprovação** da prestação nem parecer. |
| Percentuais da CF art. 166 §§ 9º e 9º-A (art. 8º X) | 🟡 | A cota por vereador e os 50% da saúde são controlados. **RCL e percentual da RCL estão vazios** no exercício 2026, então o limite da LOA não é conferido. Os textos de base legal do sistema dizem "por simetria / ver Lei Orgânica"; a IN trata esses percentuais como **obrigatórios** (ADIs 6670 e 7493) — ajustar redação. |
| Saúde aprovada pelas instâncias de governança do SUS (Rec. art. 2º § 3º) | ❌ | Sem registro de aprovação (conselho/gestor do SUS), sem anexo, sem pendência. |
| Auditoria do controle interno (art. 8º VIII; Rec. VIII) | ❌ | Não há perfil/relatório próprio para o controle interno atestar as medidas (a trilha de auditoria e os relatórios existem e ajudam). |
| Suspender execução se não houver conformidade (art. 8º XI; Rec. art. 4º § 1º) | ❌ | O sistema **não bloqueia** nem alerta forte empenho/pagamento de emenda com publicidade incompleta. |

## 4. A forma de dar publicidade está certa?

**Pontos fortes:** portal público sem login, dados abertos em CSV/JSON, atualização automática, filtros, linguagem simples, lista fechada de campos, cabeçalhos de segurança.

**Problemas críticos de publicidade:**
1. **Faltam elementos obrigatórios** (ver tabela: localidade, plano de trabalho, relatório de gestão, gestor, banco/conta, SUS, CNPJ, processo/contrato, datas, cronograma da execução direta, LOA).
2. **Escolhas de proteção de dados que contrariam a IN**: gestor responsável e conta bancária estão ocultos/mascarados. A IN manda publicar o **nome completo do gestor** e o **número da conta**. Sobre a LGPD: conta de pessoa jurídica e nome de agente público no exercício da função não são dados pessoais sensíveis; a proteção continua válida para **CPF, endereço e dados de pessoa física** (mantê-los fora). Confirmar com o encarregado de dados (DPO).
3. **O rodapé do portal afirma cumprimento** ("em cumprimento à LAI, à LRF e à IN TCE-MG 05/2025"). Enquanto houver lacunas, essa frase é **arriscada** (afirma conformidade que o sistema ainda não entrega).
4. **Endereço do portal** é um domínio técnico da Vercel. O portal oficial deve ser acessível pelo site da Prefeitura/Câmara (link e, de preferência, domínio institucional) — e é preciso **informar essa URL ao TCE-MG** (Rec. art. 4º).
5. **Prazo já vencido:** a Recomendação pedia a informação ao TCE-MG **até 01/02/2026**, pelo Portal de Emendas Parlamentares do TCE (https://acompanhe-emendas-ia.tce.mg.gov.br/), **mesmo sem emendas**. Verificar se o Executivo e a Câmara informaram. Esse envio é manual/externo; o layout do TCE não foi fornecido, então o CSV do sistema é só apoio.
6. **Textos de base legal no sistema** citam a CF art. 166 "por simetria"; a IN indica obrigatoriedade pelos entes subnacionais (§§ 9º e 9º-A, ADIs 6670/7493) e a LC 210/2024. Atualizar a redação e citar a IN 05/2025 art. 7º nos campos correspondentes.

## 5. Qualidade dos dados atuais (impacta o que se publica)
- CNPJ: **0 de 215** beneficiários.
- Partido: **0 de 15** vereadores.
- Conta bancária: 60 de 90 execuções; gestor da Prefeitura: 64 de 90; vínculo com o Compras: 0.
- Documentos anexados: **0** (nem plano de trabalho, nem parecer, nem relatório).
- RCL e % da RCL do exercício: vazios.
- Já sinalizados antes: pagas sem data/empenho, empenhos repetidos, objetos genéricos (nº 21, 22, 63).

## 6. Plano de adequação recomendado (por prioridade)

### A. Antes de qualquer outra coisa (decisão e fatos)
1. Confirmar com a Procuradoria/controle interno **o que se aplica às emendas de vereadores** (itens ❔) e **quem** publica (Executivo e/ou Câmara).
2. Verificar se foi feita a **informação ao TCE-MG (prazo 01/02/2026)**; se não, regularizar.
3. Editar o rodapé do portal para **não afirmar conformidade integral** até concluir os itens abaixo.
4. Definir por **ato normativo** (decreto/portaria) o **ciclo de fiscalização e aprovação das contas** (art. 8º IV) — o sistema depois passa a apoiá-lo.

### B. Cadastro — acrescentar (1ª entrega, rápida)
- `partido` dos vereadores (dado já existe no cadastro, falta preencher) e exibir.
- `localidade` (município/bairro) por emenda.
- CNPJ dos beneficiários (preenchimento obrigatório para repasses; é dado público).
- Banco, agência e conta **estruturados** (em vez de texto livre); validação de **banco oficial**.
- Nº da LOA/crédito exibido; RCL e % da RCL do exercício.
- Cronograma previsto (início/término) também para **execução direta**.
- Anuência do SUS (sim/não/não se aplica + data/documento) para emendas de saúde.
- Identificador contábil da emenda (fonte de recurso/código) e exigência no empenho.

### C. Publicação — acrescentar/alterar no portal
- Exibir: partido, localidade, LOA, **descrição detalhada**, **processo administrativo/licitatório e contrato**, **gestor responsável (nome completo)**, **banco e conta** (decisão do DPO), **GND**, **todas as datas** de empenho/liquidação/repasse, cronograma, anuência SUS, CNPJ do beneficiário e do Município.
- Disponibilizar o **Plano de Trabalho** e o **Relatório de gestão** (PDF) por emenda, com link público.
- Manter fora: CPF, endereço de pessoa física, dados pessoais de dirigentes.

### D. Documentos e prazos — criar
- **Plano de Trabalho**: anexo + campos mínimos (objeto, metas, estimativa por fonte, corrente × capital, prazo e cronograma); exigido **antes do empenho**.
- **Relatório de gestão**: anexo, **prazo 30/06 do ano seguinte** e atualização anual até o término; alerta por vencimento; pendência de gravidade alta quando vencido.
- Análise e **aprovação/reprovação da prestação de contas**, com parecer e data.
- Download público protegido (links temporários/rota própria — o bucket é privado).

### E. Controles automáticos (pendências e bloqueios)
- Pendência **"publicidade incompleta"**: lista os itens do art. 7º que faltam; **alta** se a emenda já tem empenho/pagamento; opção de **bloquear** empenho sem os itens (art. 8º XI).
- **Conta repetida** entre emendas e conta fora de banco oficial (art. 6º).
- Emenda de saúde sem anuência do SUS.
- Plano de Trabalho ausente em repasse/execução; relatório de gestão vencido.
- Conferência da cota contra RCL.

### F. Controle interno e relatórios
- Perfil de leitura para o **controle interno** e relatório "conformidade com a IN 05/2025" (item a item, por emenda) para suportar auditoria e o **plano de ação** que o TCE pode exigir (art. 9º).
- Exportação no layout do **Portal de Emendas do TCE-MG** assim que o Tribunal publicar as instruções (não temos o layout).

### G. Textos
- Atualizar `base-legal.ts`: IN 05/2025 art. 7º/6º, LC 210/2024, CF art. 166 §§ 9º e 9º-A (ADIs 6670/7493), Lei 13.019 arts. 10 a 12 (transparência das OSCs).

## 7. Itens que provavelmente NÃO dependem do sistema
Ato normativo do ciclo de contas; adaptação do plano de contas e classificação de receita (Contabilidade); Transferegov/OPP e fundo a fundo (se aplicáveis); auditoria formal do controle interno; envio ao Portal do TCE-MG.

## 8. Resumo
O sistema entrega boa parte da **rastreabilidade** (fases, financeiro, histórico, pendências, vínculo com o Compras) e um **portal de transparência funcional**, mas **não atende integralmente ao art. 7º da IN 05/2025**: dos 17 elementos do art. 7º, só 2 estão plenos (IV valor e V órgão/beneficiário), 8 estão parciais e 7 faltam por completo (localidade, Plano de Trabalho, Relatório de gestão, CNPJ, gestor, conta/banco e anuência do SUS) (Plano de Trabalho, Relatório de gestão, localidade/anuência SUS e identificadores contábeis). Além disso, o portal **oculta dois dados que a IN manda publicar** (gestor e conta) e **não impede a execução sem publicidade completa**, que é o ponto de maior risco regulatório (suspensão de emendas).
