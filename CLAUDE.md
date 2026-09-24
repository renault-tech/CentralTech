# CLAUDE.md — Central Cataguases (Hub)

Contexto para qualquer sessão do Claude Code que abrir este repositório.
Leia antes de qualquer alteração.

## O que é este app

Um lançador de módulos: uma tela com cards, cada um linkando para a URL
real de produção de um sistema da Prefeitura (hoje Compras/Licitações/
Contratos, Numeração de Documentos, Requerimentos da Câmara). **Não há SSO
de verdade** — cada módulo é um app Next.js independente, com sua própria
sessão. O Hub só decide quais cards aparecem para cada pessoa.

## Arquitetura

- **Mesmo projeto Supabase do App-Compras/Requerimentos**
  (`nfijlzndlioefayctbsh`), schema próprio `hub`. Como é o mesmo projeto,
  compartilha `auth.users` com Compras e Requerimentos — mesma
  credencial/senha, acesso ainda liberado módulo a módulo (uma linha em
  `hub.usuarios` + `hub.acessos_modulo` por pessoa).
- **Numera é um projeto Supabase totalmente separado**
  (`uxdjhdnsnditivvjktzf`) — decisão deliberada (evitar depender de um
  único ponto de falha, e sobretudo porque migrar senhas reais entre
  projetos Supabase não é possível: os hashes não são compatíveis). Por
  isso o acesso de quem só tinha conta no Numera precisa passar por criar
  uma conta nova no Hub + primeiro acesso por "Esqueci minha senha" — ver
  `src/components/hub/importador-numera.tsx`.
- **`supabase/migrations/`** (criado nesta sessão — o repo não tinha
  nenhuma até então; o schema só existia no banco remoto). A partir de
  agora, toda mudança de schema do Hub é migration versionada, testada
  transacionalmente no banco de produção antes de aplicar de verdade
  (mesmo padrão do CLAUDE.md do App-Compras: `begin`/cenários/`raise
  exception` forçado, `get_advisors` depois).
- **Provisionamento automático do módulo Compras**: RPC
  `hub.provisionar_acesso_modulo(p_modulo)` (aditiva, chamável pelo
  próprio usuário — diferente de `definir_acesso`, que só admin chama e
  substitui todos os módulos de uma vez) + backfill único na migration
  `20260922010000`. O App-Compras chama essa RPC via
  `supabase.schema("hub").rpc(...)` no clique do aviso de plataforma nova
  (`src/lib/hub/provisionar-acesso.ts` no repo do Compras). Primeira
  leitura cross-schema deste projeto (`hub.*` lendo `public.usuarios`) —
  mesmo banco físico, sem acoplamento externo.

## Convenção: página "Novidades" sempre atualizada

`src/app/novidades/page.tsx` lê de `src/lib/novidades.ts` (array simples
`{data, titulo, descricao}`, sem banco — conteúdo editorial, editado no
código). **Regra fixa deste repositório**: toda mudança visível ao usuário
no Hub (nova tela, novo módulo, mudança de fluxo de acesso) ganha uma
entrada nova em `NOVIDADES`, no mesmo commit da mudança — mais recente
primeiro. Não é opcional nem "quando lembrar": é a forma como este projeto
resolve "o tutorial deve estar sempre atualizado", sem precisar de uma
tela de administração para isso.

## Tutorial guiado

Mesmo mecanismo do App-Compras (driver.js), portado nesta sessão:
`src/lib/tours/tours.ts` (registro, hoje só o tour "boas-vindas-hub"),
`src/components/ajuda/executar-tour.ts` (import dinâmico do driver.js, só
carrega quando um tour roda de fato), `gerenciador-tours.tsx` (roda o
boas-vindas uma vez por navegador via `localStorage`), `botao-ajuda.tsx`
no header (permite rever o tour a qualquer momento). Ao adicionar uma
tela nova ao Hub que mereça um tour, seguir o mesmo padrão: um novo `Tour`
no array, com `data-tour="..."` nos elementos-alvo.

## Cadastro unificado: solicitação de acesso, aprovação por app, bloqueio de login direto

Pedido do usuário: antes disso, só o admin cadastrava (Compras/
Requerimentos sem autocadastro) e `hub.definir_acesso` **exigia que a
pessoa já tivesse conta em algum módulo** — quem nunca tinha login em
nenhum dos 3 apps não tinha como ser cadastrado pelo Hub. Resolvido com um
cadastro único: qualquer pessoa pede acesso, o admin_hub aprova módulo a
módulo com a configuração específica de cada app, e quem já tem conta em
algum lugar mantém a MESMA conta (nunca duplica usuário).

- **`hub.solicitacoes_acesso`** (migration `20260924000000`): pedido
  público (`nome`, `email`, `modulos_solicitados`, `secretaria_sugerida`,
  `justificativa`, `status`). RLS: `insert` aberto a `anon` E
  `authenticated` com `status = 'pendente'` — é o único jeito de alguém
  sem conta nenhuma conseguir pedir acesso; `select`/`update` só
  `hub.eh_admin_hub()`. **Achado de teste real**: um `insert ... returning`
  de `anon` aciona a policy de SELECT (para validar a linha retornada) —
  por isso `eh_admin_hub()` precisou de EXECUTE para `anon` também (sempre
  resolve `false` pra quem não tem sessão, sem risco).
- **`hub.rejeitar_solicitacao`** (RPC simples, admin_hub-gated) e
  **`hub.definir_acesso` com revogação em cascata** (migration
  `20260924010000`): tirar um módulo no Hub agora também desativa a conta
  no app correspondente (`public.usuarios.ativo = false` /
  `requerimentos.usuarios.ativo = false`) — antes só tirava o "cartão" do
  Hub e a pessoa continuava entrando direto no app. `numera` fica de fora
  desse `create or replace` (projeto separado, sem como alcançar de lá).
- **`hub.config_modulo` + `hub.esta_bloqueado_login_direto` +
  `hub.definir_bloqueio_login_direto`** (migration `20260924020000`):
  interruptor por app, desligado por padrão nos 3. A função de leitura
  precisa ser chamável ANTES do login (`anon` também tem EXECUTE) — cada
  app (Compras, Requerimentos) checa isso na própria `/login` via um
  cliente mínimo (`hub-cliente.ts` em cada repo, mesmo projeto/anon key,
  só schema diferente).
- **`/solicitar-acesso`** (página pública): formulário
  (`solicitar-acesso-form.tsx` + `lib/actions/solicitar-acesso.ts`),
  linkado a partir de `/login`. Funciona igual logado ou não (a policy de
  insert cobre os dois casos).
- **Configurações → "Solicitações"** (`painel-solicitacoes.tsx`): lista
  pendentes; expandir uma mostra, por módulo pedido, o formulário
  específico daquele app (Compras: perfil+setor; Requerimentos:
  perfil+secretaria; Numera: nível+documentos). "Aprovar" chama
  `aprovarSolicitacao` (`lib/actions/solicitacoes.ts`) — a peça mais
  complexa desta entrega:
  1. **Conta compartilhada** (Compras/Requerimentos/Hub são o MESMO
     projeto Supabase): resolve/cria via `criarClienteAdmin()` (mesmo
     padrão do importador do Numera — tenta `createUser`, cai para busca
     paginada por e-mail se já existir).
  2. **Compras**: existência checada via `criarClienteAdminBruto()`
     (service role, sem schema fixo — para ler `public.usuarios` sem
     depender da RLS de lá, que a sessão do admin do Hub não
     necessariamente satisfaz), decide entre `admin_criar_usuario`/
     `admin_atualizar_usuario`, chamadas via `compras-cliente.ts`
     (cliente autenticado com a MESMA sessão/cookies do Hub, só schema
     `public` — o `auth.uid()` é compartilhado, então
     `hub.eh_admin_hub()` dentro dessas RPCs resolve certo).
  3. **Requerimentos**: mesma ideia, `requerimentos-cliente.ts` +
     `requerimentos.definir_acesso` (upsert único, não precisa distinguir
     criar/atualizar).
  4. **Numera** (projeto Supabase SEPARADO — não tem como reaproveitar a
     conta compartilhada): `numera-admin.ts` (service role do projeto do
     Numera, precisa de `NUMERA_SUPABASE_SERVICE_ROLE_KEY`, **passo
     manual do dono da plataforma** — colar essa chave nas env vars da
     Vercel; sem ela, só o módulo Numera falha, com mensagem clara, os
     outros da mesma solicitação seguem normalmente). Cria/reaproveita a
     conta lá (mesmo padrão find-or-create), grava `role`/
     `allowed_documents`/`approved=true` em `public.users`.
  5. **`generateLink({type:'invite'})`** para toda conta **recém-criada**
     (compartilhada ou Numera) — devolve um link pronto **sem depender de
     e-mail chegar**, mostrado na tela com botão de copiar. Resolve a
     dependência de SMTP (o Numera nunca teve configurado) na raiz: o
     e-mail automático continua existindo como caminho alternativo, não
     como único caminho.
  6. Falha num módulo não desfaz os outros — relatório por módulo, mesmo
     padrão do importador de planilha do Compras.
- **Configurações → "Login direto por aplicativo"**
  (`painel-login-direto.tsx` + `lib/dados/login-direto.ts` +
  `lib/actions/login-direto.ts`): um cartão por app com "`X de Y` usuários
  ativos já acessaram pelo Hub" (lido de `ultimo_acesso_origem`/
  `veio_do_hub_em`, gravados por `marcar_login_origem` em cada app a cada
  login) + switch de bloqueio para Compras/Requerimentos.
  **Numera é só informativo, de propósito**: como não há SSO real, o card
  do Numera no Hub só *linka* de volta para o login nativo dele — bloquear
  o login direto ali não tem substituto (deixaria todo mundo sem entrar),
  então o switch não é oferecido para esse módulo, só o sinal de adoção.
- **Achado do `get_advisors` pós-migration, corrigido de carona nos
  repos do Compras/Requerimentos**: qualquer RPC **nova** (não
  `create or replace` de uma já existente) pode nascer com EXECUTE
  concedido a `anon` via default privilege do schema, mesmo com
  `revoke ... from public` na própria migration — só `revoke ... from
  anon` explícito remove. Confirmado com `has_function_privilege` antes/
  depois em cada função nova desta entrega.
- **Recuperação de senha do Numera: construída nesta entrega** (não
  existia antes — achado da verificação pedida pelo usuário antes de
  aprovar o plano). `auth-service.js` ganhou `requestPasswordReset`/
  `updatePassword`; `app.js` ganhou o link "Esqueci minha senha" na tela
  de login, um modal de e-mail, e uma tela dedicada de nova senha
  (`showResetPasswordView`, guardada por um flag `inPasswordRecovery`
  para não ser sobrescrita por `checkAutoLogin`/`render` enquanto o link
  de recuperação está sendo processado). O Numera também passou a marcar
  `ultimo_acesso_origem`/`veio_do_hub_em` (quando chega com
  `?origem=hub`) e a ler `app_config.loginDiretoBloqueado` — ver
  `app-numera--o-de-docs` (sem CLAUDE.md próprio ainda).

- **Varredura pós-entrega do cadastro unificado (pedido do usuário logo
  em seguida): 5 achados reais corrigidos.** Confirmado a ele, antes de
  começar: quem já tinha acesso a algum app **mantém esse acesso** —
  nada nesta entrega desativa conta nenhuma sozinho; a revogação em
  cascata (migration `20260924010000`) só age quando um admin
  explicitamente desmarca um módulo.
  1. **Bug real: bookkeeping do Numera perdido quando combinado com
     outro módulo.** `aprovarSolicitacao` fazia o bookkeeping do Hub
     (`hub.acessos_modulo`) logo depois de processar Compras/
     Requerimentos, e só voltava a gravar Numera se ele fosse o ÚNICO
     módulo da solicitação — aprovar Compras+Numera juntos criava a
     conta certinho no projeto do Numera, mas o "cartão" nunca aparecia
     no Hub nem em "Usuários e acessos". Corrigido resolvendo a conta
     compartilhada uma única vez, processando os 3 módulos, e só então
     fazendo o bookkeeping (uma vez, com o resultado completo).
  2. **Validação client-side no formulário de aprovação.** Perfil que
     exige setor (Compras) ou secretaria (Requerimentos) sem nada
     selecionado antes só falhava no servidor com erro cru de RPC/
     `CHECK` constraint (`secretaria_so_para_perfil_secretaria`,
     confirmado existir no banco). Agora o botão "Aprovar" fica
     desabilitado com aviso inline nesses casos; nível "Restrito" do
     Numera sem nenhum documento marcado ganha aviso (não bloqueia,
     documentos dá pra ajustar depois).
  3. **Reativação simétrica em `hub.definir_acesso`.** A revogação em
     cascata (desativar a conta no app quando um módulo é removido)
     não tinha o inverso: marcar o módulo de novo não reativava — o
     admin via a caixa marcada e achava que tinha resolvido, mas a
     pessoa continuava barrada, exigindo um segundo passo manual direto
     no Compras/Requerimentos. Corrigido em
     `20260924030000_definir_acesso_reativacao_simetrica.sql`: um
     módulo **adicionado** nesta chamada (não estava, passa a estar)
     também reativa a conta — só quando adicionado, não quando
     resubmetido sem mudança (preserva uma desativação feita
     diretamente no app por outro motivo). Testado transacionalmente
     (remove→desativa, readiciona→reativa, resubmete a mesma lista→não
     mexe).
  4. **Histórico de solicitações decididas + retentativa.** Uma vez
     "aprovada", a solicitação sumia de vista pra sempre — inclusive
     quando um módulo tinha falhado (ex.: Numera sem a chave
     configurada), sem nenhum rastro do que precisava de nova
     tentativa. Agora `atualizarBookkeepingHub`/`aprovarSolicitacao`
     grava um resumo por módulo em `observacao_decisao`
     (`"Compras: ok · Numera: falhou (...)"`), e uma seção "Decididas
     recentemente" (`listarSolicitacoesDecididas`, últimas 15) mostra
     esse resumo com um badge (Aprovada/Parcial/Recusada) e permite
     reabrir o formulário para tentar de novo só os módulos que
     falharam — a busca da solicitação em `aprovarSolicitacao` passou a
     aceitar `status in ('pendente', 'aprovada')` (nunca uma
     'recusada', essa é definitiva). O botão "Recusar" some nesse
     modo de retentativa (a RPC `rejeitar_solicitacao` só aceita
     'pendente', recusaria com erro sem sentido).
  5. **Cache-busting do Numera não avançou.** `app.js`/`auth-service.js`
     foram editados (recuperação de senha) mas o `?v=...` em
     `index.html` continuava apontando pro build antigo — navegador com
     cache guardado continuaria rodando a versão sem a correção. Corrigido
     avançando a versão nos dois `<script src>`.
  Também um aviso de UX (não um bug): a tela "Conceder acesso" existente
  em Configurações ganhou uma nota quando o admin desmarca Numera —
  lembrando que isso só tira o cartão do Hub, a conta de lá (projeto
  separado, sem SSO) continua ativa até ser desativada direto no Numera.
  `tsc`/`eslint`/`vitest`/`next build` verdes nos 3 repos Next.js depois
  de cada correção; `get_advisors` conferido sem categoria nova de
  exposição (15 anon-executável — os 2 já esperados desta entrega — e
  83 authenticated-executável, mesma contagem de antes).

- **Configurações virou um hub de cards por área** (pedido do usuário: a
  tela empilhava as 4 seções — Solicitações, Usuários e acessos, Importar
  do Numera, Login direto — verticalmente, e era preciso rolar bastante
  para chegar na última). Reestruturado no mesmo padrão já usado no
  App-Compras (`configuracoes/layout.tsx` + `AbasNavegacao`, portado para
  cá — não existia neste repo ainda, só no Compras): um `layout.tsx`
  compartilhado (gate de `admin_hub`, `CabecalhoPagina` fixo, faixa de
  abas) e uma sub-rota por área (`/configuracoes/solicitacoes`,
  `/usuarios`, `/numera`, `/login-direto`), cada uma buscando só os
  próprios dados. O índice (`/configuracoes`) virou um grid de 4 cards
  (mesmo visual dos cards de Configurações do Compras), com um selo
  vermelho no card de Solicitações mostrando a contagem de pendentes —
  único indicador com um "pendente" natural entre as 4 áreas. Os 4
  componentes (`PainelSolicitacoes`, `PainelConfiguracoes`,
  `ImportadorNumera`, `PainelLoginDireto`) perderam o `mt-6` do próprio
  `<section>` (empilhavam um atrás do outro antes; agora cada um é o
  único conteúdo da própria página, o espaçamento vem do layout).
  Verificado com mockup usando o CSS compilado real (`next build`) +
  `headless_shell` em 390px e 1280px (mesmo processo já documentado no
  CLAUDE.md do App-Compras) — grid de 2 colunas no desktop, empilhado no
  mobile, selo de contagem bem posicionado nos dois. `tsc`/`eslint`/
  `vitest`/`next build` verdes.

- **Bug real: "Editar" em Usuários e acessos parecia não fazer nada**
  (relato do usuário, confirmado por investigação — sem erro de console,
  botão "Conceder acesso" funcionando normalmente, só "Editar" das linhas
  "sem reação"). Causa raiz: `editando`/`mostrarForm` era um único par de
  estado compartilhado por TODA a tabela, e o formulário renderizava numa
  posição fixa **abaixo da tabela inteira**, não perto da linha clicada —
  clicar em "Editar" na 1ª linha de uma tabela com várias pessoas de fato
  atualizava o estado e abria o formulário, só que a ~500px+ abaixo da
  área visível; sem rolar, parecia que nada tinha acontecido. Confirmado
  isolando o componente real (sem alterar nada) numa rota de teste
  temporária, clique de verdade via Playwright: distância entre o botão
  clicado e o formulário aberto era de centenas de pixels antes da
  correção. Corrigido trocando o par de estado por `editandoId: string |
  null` (por linha) + `criandoNovo: boolean` (independente, para
  "Conceder acesso"), e o formulário passou a abrir **dentro da própria
  linha** (`<tr>` com `colSpan`, mesmo padrão de linha expansível já usado
  no App-Compras para Processos/Contratos) — nunca mais precisa rolar até
  o fim da tabela. Reconfirmado com o mesmo teste (Playwright, clique
  real): formulário aparece a 68px do botão clicado, e abrir outra linha
  fecha a anterior (exclusividade). `tsc`/`eslint`/`vitest`/`next build`
  verdes.

## Como continuar de outro computador

1. `git clone`, `nvm use` (`.nvmrc`), `npm install --legacy-peer-deps`
   (mesmo workaround de `npm`/arborist já documentado no App-Compras).
2. `.env.local` a partir de `.env.example` — inclui as chaves do projeto
   compartilhado (mesmas do Compras) e, para o importador do Numera,
   `NUMERA_SUPABASE_URL`/`NUMERA_SUPABASE_ANON_KEY` (não são segredos —
   a mesma chave já vai hardcoded no client-side do próprio Numera).
   **Passo manual do dono da plataforma** (obrigatório antes de aprovar o
   módulo Numera em qualquer solicitação de acesso): copiar a **service
   role key** do projeto Numera (`uxdjhdnsnditivvjktzf`, Supabase →
   Settings → API) para `NUMERA_SUPABASE_SERVICE_ROLE_KEY` nas env vars do
   projeto `centraltech` na Vercel — é a única forma de criar conta/
   aprovar diretamente no banco do Numera a partir do Hub. Sem isso,
   aprovar só o módulo Numera falha com mensagem clara (Compras/
   Requerimentos da mesma solicitação continuam funcionando).
3. `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` antes
   de considerar qualquer mudança concluída.
4. Migrations novas: `supabase/migrations/`, timestamp maior que o
   último, testadas transacionalmente no projeto `nfijlzndlioefayctbsh`
   antes de aplicar (mesmo processo documentado no CLAUDE.md do
   App-Compras — este repo compartilha o banco, não as regras têm que
   ser reinventadas).
