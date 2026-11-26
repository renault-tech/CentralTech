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

- **Auditoria de segurança completa da plataforma** (pedido do usuário,
  "erros como este não podem acontecer" — depois do bug do botão Editar
  fora da tela). Achados reais e corrigidos neste repo:
  - **DoS não autenticado contra a única tela de aprovação de acesso.**
    A policy `qualquer_um_solicita_acesso` (INSERT em
    `hub.solicitacoes_acesso`) só travava `status = 'pendente'` — a
    validação de que `modulos_solicitados` só contém
    `compras`/`numera`/`requerimentos` existia SÓ no Zod da server
    action, contornável com um INSERT direto via PostgREST (a `anon` key
    é pública). Um `modulos_solicitados` com chave inválida faz
    `PainelSolicitacoes` acessar `MODULOS[m].cor` de um `undefined` —
    `TypeError` em render, sem nenhum `error.tsx` no repo para
    recuperar. Resultado: um request não autenticado derrubava a tela
    de Solicitações inteira até alguém apagar a linha direto no banco —
    negação de serviço real contra o único fluxo de concessão de acesso
    da plataforma. Corrigido em duas camadas
    (`20260924040000_solicitacoes_acesso_validacao_servidor.sql`):
    - CHECK no banco: `modulos_solicitados <@ array[...]` + array não
      vazio + limite de tamanho em `nome`/`email`/`justificativa`/
      `secretaria_sugerida` (a validação de verdade tem que estar onde
      ninguém consegue contornar — mesma regra de sempre deste
      ecossistema).
    - `with_check` do INSERT ganhou `decidido_por is null and
      decidido_em is null and observacao_decisao is null` — antes um
      `anon` podia forjar esses campos de auditoria numa linha ainda
      "pendente" (achado de baixa severidade, corrigido junto).
    - `moduloInfo()` novo em `src/lib/modulos-info.ts` — defesa em
      profundidade: `MODULOS[chave]` direto nunca mais é usado nos
      pontos que renderizam dado vindo do banco (`painel-solicitacoes.tsx`);
      chave desconhecida cai num fallback neutro em vez de quebrar a tela.
    - Testado transacionalmente (5 cenários: insert válido passa, módulo
      forjado bloqueado, array vazio bloqueado, `decidido_por` forjado
      bloqueado, nome gigante bloqueado) antes de aplicar.
  - **`recusarSolicitacao` não replicava a checagem de `admin_hub`** que
    `aprovarSolicitacao` e `importarUsuariosNumera` já têm — a RPC
    `rejeitar_solicitacao` já se protegia sozinha (`hub.eh_admin_hub()`),
    então não era um bypass real, só inconsistência de padrão. Corrigido
    por defesa em profundidade.
  - **Open redirect real (CWE-601)** em `src/app/auth/confirm/route.ts`
    — mesmo achado e mesma correção aplicados nos 3 repos Next.js, ver
    detalhe no CLAUDE.md do App-Compras. De carona: o fallback quando
    `next` está ausente era `/dashboard`, rota que **não existe** neste
    repo (herdado de copiar o arquivo do App-Compras sem ajustar) —
    corrigido para `/` (a Início do Hub).
  - Auditoria também confirmou, sem achado: nenhuma RPC do schema `hub`
    usa `<>` em vez de `IS DISTINCT FROM` contra coluna nullable; grants
    a `anon` batem exatamente com o que já era esperado (15
    anon-executável, só `eh_admin_hub`/`esta_bloqueado_login_direto`
    no schema `hub`); `aprovarSolicitacao` checa `admin_hub` antes de
    qualquer uso da Admin API; nenhum segredo `service_role` vaza pro
    client-side; gate de `/configuracoes/*` cobre todas as sub-rotas.

- **Bug real: link de "esqueci minha senha" levava de volta ao login, não
  à redefinição — corrigido.** Diagnosticado direto pelos logs do
  Supabase (`query_logs`, `source = 'auth_logs'`, projeto
  `nfijlzndlioefayctbsh`): a sequência real do usuário foi `POST /recover`
  (200, `user_recovery_requested`) e, ao clicar no link do e-mail,
  `GET /verify` (303, `auth_event.action: "login"`, **sucesso**) — o token
  era válido e o GoTrue autenticava normalmente. O problema estava depois:
  nenhuma chamada a `POST /token` (PKCE) apareceu nos logs em seguida, ou
  seja, nosso `/auth/confirm` (rota de SERVIDOR, só lê `code`/`token_hash`
  da query string) nunca recebeu nada útil. **Causa raiz**: o link padrão
  de recuperação do Supabase passa primeiro pelo endpoint hospedado do
  próprio GoTrue (`.../auth/v1/verify`, é o que os logs mostraram), que
  autentica e só então redireciona para o `redirectTo` configurado —
  anexando os tokens como **fragmento da URL** (`#access_token=...&type=
  recovery`), não como query string. Um fragmento (`#...`) nunca chega ao
  servidor (é só o navegador que o lê) — por isso `/auth/confirm` sempre
  caía direto no fallback `/login?motivo=link_invalido`, batendo
  exatamente com o sintoma relatado pelo usuário.
  **Correção** (`src/lib/actions/auth.ts`, `solicitarRecuperacao`):
  `redirectTo` passou a apontar direto para `/redefinir-senha` (uma
  página de CLIENTE), pulando `/auth/confirm`. Novo componente
  `src/components/guarda-recuperacao.tsx` (`GuardaRecuperacao`, envolve
  `<FormularioRedefinir/>` na página) espera o cliente Supabase do
  navegador (`criarClienteNavegador`, `detectSessionInUrl` ligado por
  padrão) processar o fragmento sozinho ao montar a página — como é um
  client `@supabase/ssr` (não o `@supabase/supabase-js` puro), ele
  sincroniza a sessão nos cookies também, então a server action
  `redefinirSenha` (que lê a sessão via `criarClienteServidor()`, baseado
  em cookie) continua funcionando sem nenhuma mudança. `GuardaRecuperacao`
  mostra "Validando o link…" enquanto espera (checa `getSession()` no
  mount + assina `onAuthStateChange` para `PASSWORD_RECOVERY`/
  `SIGNED_IN`), com um timeout de 6s que mostra "link inválido ou
  expirado" + atalho para pedir um novo, caso a pessoa chegue na página
  sem vir de um link válido. `/auth/confirm/route.ts` não foi removida
  (continua válida para um eventual link `code`/`token_hash` direto no
  futuro), só deixou de ser o caminho usado pela recuperação de senha.
  **Não testado ponta a ponta** (mesma limitação de sempre — o sandbox
  não alcança `*.supabase.co`); verificado por leitura dos logs reais do
  incidente relatado + `tsc`/`eslint`/`vitest`/`next build` limpos.
  **Lição**: para um bug de auth "silencioso" (sem exceção visível pro
  usuário), `query_logs` com `source = 'auth_logs'` no projeto do
  Supabase mostra a sequência exata de chamadas — inclusive quais NÃO
  aconteceram, que foi o que revelou a causa real aqui (mesmo padrão já
  documentado no CLAUDE.md do App-Compras para o SMTP da Brevo, agora
  também útil para depurar o fluxo de tokens em si, não só entrega de
  e-mail).

- **Nova tela `/conta` — "Minha conta"** (pedido do usuário, junto do bug
  acima: uma forma de trocar a senha pela própria tela do Hub para quem
  lembra a senha atual, sem depender de e-mail). A server action
  `mudarSenhaLogado` já existia em `src/lib/actions/auth.ts` desde uma
  sessão anterior mas nunca tinha sido ligada a nenhuma tela — corrigido
  criando `src/app/conta/page.tsx` +
  `src/components/conta/formulario-mudar-senha.tsx` (senha atual + nova
  senha ×2, mesmo padrão de `FormularioMudarSenha` do App-Compras,
  adaptado ao tema claro do Hub). Link de acesso: o nome do usuário no
  cabeçalho (`CabecalhoHub`) virou um link para `/conta`. Sem RPC/
  migration nova — `mudarSenhaLogado` já reautentica com a senha atual
  antes de trocar (`signInWithPassword` como checagem, não como troca de
  sessão) e usa `updateUser`, exatamente como o equivalente do Compras.

- **Bug real: "Conceder acesso" em Configurações → Usuários e acessos não
  dava acesso nenhum de verdade — corrigido.** Relatado pelo usuário: a
  coordenação tentou liberar Requerimentos para uma usuária que só tinha
  conta no Numera (projeto Supabase à parte) e recebeu "Nenhuma conta
  encontrada com o e-mail ... A pessoa precisa já ter login em algum
  módulo da plataforma" — justamente na tela pensada para ser "a forma"
  de dar acesso, sem passar por `/solicitar-acesso`.
  **Causa raiz**: `definirAcesso` (`src/lib/actions/configuracoes.ts`)
  sempre chamou só `hub.definir_acesso`, que (a) exige que `auth.users`
  já tenha o e-mail (`select id into v_auth_id from auth.users where
  lower(email) = ...; if v_auth_id is null then raise exception`) e (b)
  mesmo quando a conta já existia, só grava o cartão em
  `hub.acessos_modulo` — nunca chamou a RPC do módulo em si
  (`admin_criar_usuario` no Compras, `requerimentos.definir_acesso` no
  Requerimentos, upsert em `users` no Numera), então marcar um módulo
  aqui nunca criou o cadastro real, só um indicador visual sem
  permissão nenhuma por trás. O fluxo de `/solicitar-acesso` →
  `aprovarSolicitacao` já resolvia os dois problemas (cria a conta
  compartilhada via Admin API antes de tudo, chama a RPC de cada módulo)
  — só a concessão DIRETA pelo admin nunca tinha recebido a mesma
  correção.
  **Correção**: extraídas para `src/lib/actions/provisionamento-
  modulos.ts` as funções que antes só existiam em `solicitacoes.ts`
  (`encontrarOuCriarConta`, `gerarLinkPrimeiroAcesso`, `aprovarCompras`,
  `aprovarRequerimentos`, `aprovarNumera`, `sincronizarBookkeepingHub`),
  agora recebendo `{ nome, email, secretariaSugerida? }` em vez do objeto
  inteiro de uma solicitação — reaproveitável por quem não tem uma linha
  em `solicitacoes_acesso`. `definirAcesso` passou a aceitar um campo
  `decisoes` (mesmo formato `DecisaoAprovacao` da aprovação de
  solicitações) e, para cada módulo presente ali: cria/reaproveita a
  conta compartilhada primeiro (por isso a RPC de bookkeeping nunca mais
  falha por "conta não encontrada" — a conta já existe quando ela é
  chamada), chama a RPC do módulo de verdade, e só grava no
  `hub.acessos_modulo` os módulos que realmente foram provisionados com
  sucesso (uma falha num módulo não marca o cartão do Hub com acesso que
  a pessoa não tem).
  **UI** (`src/components/hub/painel-configuracoes.tsx`): o formulário
  "Conceder acesso"/"Editar" ganhou os mesmos blocos de decisão
  (perfil+setor do Compras, perfil+secretaria do Requerimentos,
  nível+documentos do Numera) já usados em "Solicitações de acesso" —
  só aparecem para um módulo que a pessoa **ainda não tinha** antes desta
  edição (`precisaDecisao`), para não arriscar reabrir o formulário e
  rebaixar sem querer o perfil de alguém que já tinha o módulo. Página
  `/configuracoes/usuarios` passou a buscar os mesmos catálogos
  (setores do Compras, secretarias do Requerimentos, documentos do
  Numera) que `/configuracoes/solicitacoes` já buscava, via as mesmas
  funções de `lib/dados/solicitacoes.ts`. Resultado por módulo (sucesso/
  falha + link de primeiro acesso copiável quando a conta acabou de ser
  criada) mostrado do mesmo jeito que na aprovação de solicitação.
  **Nenhuma migration** — as RPCs (`hub.definir_acesso`,
  `requerimentos.definir_acesso`) continuam exigindo a conta já existir;
  a correção garante que ela é criada ANTES de chamá-las, na camada de
  aplicação, não no banco. Verificado com `tsc`/`eslint`/`vitest`/
  `next build` limpos. **Não testado ponta a ponta** (mesma limitação de
  sempre, sandbox sem acesso a `*.supabase.co`) — pendente confirmação do
  usuário concedendo Requerimentos de verdade para a usuária do caso
  real que motivou a correção.

## Bypass do SMTP quebrado do Numera para recuperação de senha

O "esqueci minha senha" do app do Numera falhava silenciosamente:
diagnosticado numa sessão anterior (logs, testes de credencial isolados
via PowerShell `Send-MailMessage`, descarte de IP-block da Brevo) até
isolar que o SMTP nativo do Supabase tem um bug confirmado de
PLATAFORMA especificamente naquele projeto — as credenciais Brevo
funcionam de verdade (e-mail chegou e apareceu no log "Tempo real" da
Brevo quando testadas fora do Supabase), só o envio disparado pelo
GoTrue nunca chega. Chamado de suporte ao Supabase já aberto; esta
correção não depende da resposta deles.

**Arquitetura**: em vez de tentar consertar o SMTP-on-587 (fora do
nosso controle), o fluxo passou a usar dois mecanismos que já provaram
funcionar — a Admin API do Supabase (`generateLink`, que nunca envia
e-mail sozinha, só devolve o link pronto na resposta — sem SMTP
envolvido) e a API HTTPS da Brevo (porta 443, a mesma testada com
sucesso via PowerShell), chamadas as duas a partir do Hub, que é quem
já tem a `NUMERA_SUPABASE_SERVICE_ROLE_KEY` (do cadastro unificado).
- `src/lib/email/brevo.ts` (`enviarEmailBrevo`): POST para
  `https://api.brevo.com/v3/smtp/email`, autenticado por header
  `api-key` (uma **Chave API** da Brevo — aba "Chaves API" em SMTP & API,
  diferente das chaves de SMTP AUTH já configuradas, sem efeito, no
  painel do Supabase). Nunca lança — erro de rede/API vira
  `{ ok: false }`, logado, para quem chama decidir (a rota abaixo sempre
  responde genérico de qualquer forma).
- `src/app/api/numera/recuperar-senha/route.ts` (rota pública, primeira
  API Route deste repo — até aqui só Server Actions): recebe
  `{ email }`, chama `criarClienteNumeraAdmin().auth.admin.generateLink
  ({ type: 'recovery', email, options: { redirectTo:
  MODULOS.numera.url + '/' } })`, e se um link voltou, manda o e-mail
  via `enviarEmailBrevo`. **Sempre responde a mesma mensagem genérica**
  (200, `{ mensagem: "Se este e-mail estiver cadastrado..." }`), erro de
  `generateLink` (e-mail sem conta) incluído — mesmo cuidado
  anti-enumeração que `resetPasswordForEmail` já tinha. CORS restrito à
  origem do próprio Numera (`MODULOS.numera.url`), com handler `OPTIONS`
  para o preflight — o app do Numera é site estático servido de outra
  origem, então precisa de `fetch` cross-origin, não Server Action.
- `envBrevo()` em `lib/env.ts`: exige `BREVO_API_KEY` e
  `BREVO_REMETENTE_EMAIL` (`BREVO_REMETENTE_NOME` tem default
  `"Numera"`). **Passo manual do dono da plataforma** (mesmo padrão já
  usado para `NUMERA_SUPABASE_SERVICE_ROLE_KEY`): colar as duas nas env
  vars do projeto `centraltech` na Vercel — `BREVO_API_KEY` vem da aba
  "Chaves API" da Brevo (gerar uma nova lá, é diferente das chaves SMTP
  já expostas numa sessão anterior), `BREVO_REMETENTE_EMAIL` precisa ser
  um remetente validado na conta Brevo (o mesmo já usado no SMTP do
  Supabase serve). Sem as duas, `enviarEmailBrevo` falha graciosamente
  (loga e devolve `ok:false`) — a rota continua respondendo genérico,
  só o e-mail não sai, mesmo padrão "pronto, só falta a chave" já usado
  no resto deste ecossistema.
- Do lado do Numera: `auth-service.js` (`requestPasswordReset`) trocou a
  chamada direta a `supabase.auth.resetPasswordForEmail` por um `fetch`
  a este endpoint — ver CLAUDE.md do `app-numera--o-de-docs` para o lado
  de lá.
- **Nenhuma migration, nenhuma mudança em `redirectTo`/`showResetPasswordView`
  do Numera** — só troca ONDE o link é gerado e QUEM manda o e-mail; o
  resto do fluxo de recuperação (evento `PASSWORD_RECOVERY`, tela de
  nova senha) continua exatamente igual.
  Verificado com `tsc`/`eslint`/`next build` limpos. **Não testado ponta
  a ponta** (mesma limitação de sempre, sandbox sem acesso a
  `*.supabase.co`/`api.brevo.com`) — pendente o usuário configurar as
  duas env vars da Brevo e confirmar o recebimento real de um e-mail.
  **Atualização (29/09/2026), bug real encontrado no primeiro uso**: o
  e-mail chegou depois de configurar a Brevo, mas o teste inicial "não
  funcionava" — causa raiz era o middleware (`src/lib/supabase/
  middleware.ts`), que redireciona (307) qualquer rota fora de
  `ROTAS_PUBLICAS` para `/login` quando não há sessão. `/api/numera/
  recuperar-senha` nunca esteve nessa lista, então o preflight `OPTIONS`
  do CORS já vinha com 307 — confirmado nos runtime logs da Vercel
  (`OPTIONS /api/numera/recuperar-senha 307`), a rota nunca chegava a
  executar. Corrigido acrescentando o **prefixo** `/api/numera/` a
  `ROTAS_PUBLICAS` (não a rota exata — evita repetir o mesmo bug para a
  próxima rota sob esse caminho). De carona, mesmo bug em
  `/solicitar-acesso` (nunca tinha sido adicionada à lista — o link
  "Solicitar acesso" do `/login` levava direto de volta pro `/login`,
  em loop, para qualquer pessoa sem sessão).

- **Endpoint novo: `/api/numera/resolver-login`** (preparação do PR3 do
  plano de migração de auth do Numera — `docs/PLANO_MIGRACAO_AUTH.md`
  no repo `app-numera--o-de-docs`). O login do Numera aceita "usuário ou
  e-mail"; a decisão do plano foi manter isso resolvendo username→e-mail
  **por uma função no servidor, não uma RPC pública direta** (uma RPC
  livre deixaria qualquer um consultar `username, email` via REST — o
  mesmo problema que a RLS aberta da tabela já tem hoje). Este endpoint
  faz exatamente essa resolução via `criarClienteNumeraAdmin()`
  (service role, sem RLS), sempre devolvendo `{email: null}` para
  username inexistente — mesmo padrão anti-enumeração (tempo constante +
  janela de repetição) do endpoint de recuperação, extraído para
  `src/lib/anti-enumeracao.ts` (`completarNoTempoMinimo`/
  `criarLimitadorPorChave`) para não duplicar entre os dois.
  **Atualização (29/09/2026): PR3 do Numera publicado** (o próprio dono
  pediu para adiantar, sem usuários ativos no momento) — este endpoint
  está em uso de verdade agora.

- **Bug real: `aprovarNumera` criava conta duplicada para gente com
  e-mail diferente entre Hub e Numera (achado no dia da publicação do
  PR3).** Caso real: Leandra Delgado tem conta migrada no Numera desde
  antes do cadastro unificado, sem e-mail próprio lá (resolvida na
  migração do Numera com o e-mail pessoal dela); no Hub, o cadastro dela
  usa um e-mail diferente. Ao conceder o módulo Numera pra ela em
  Configurações, `aprovarNumera` buscou por e-mail exato, não achou
  ninguém, e **criou uma conta nova do zero** — duplicando a pessoa no
  banco do Numera, com senha aleatória que ninguém conhece. Achado só
  na checagem de `crypt` feita antes de publicar o PR3 (comparando
  `public.users.password` com `auth.users.encrypted_password` no
  projeto do Numera); a duplicata (0 reservas, 0 logs — criada minutos
  antes) foi apagada manualmente do banco depois de confirmar que não
  tinha uso nenhum.
  **Corrigido**: antes de criar conta nova, `aprovarNumera` agora
  também busca por **nome** (case-insensitive) no Numera. Achando
  alguém com o mesmo nome e e-mail diferente, **para e devolve um erro
  pedindo confirmação do admin** — não tenta decidir sozinho (risco de
  juntar duas pessoas homônimas por engano), só evita repetir a
  duplicação silenciosa. `tsc`/`eslint`/`vitest`/`next build` limpos;
  não testado com um caso real de homônimo de propósito (baixa
  probabilidade e mensagem de erro clara o bastante para o admin
  resolver na hora).

- **PR4 do plano de migração do Numera: concluído (29/09/2026)** — ver
  `docs/PLANO_MIGRACAO_AUTH.md` do repositório `app-numera--o-de-docs`
  para o plano completo. Obrigatório antes do PR5 (fechar a RLS aberta do
  Numera): as 3 leituras do projeto Supabase do Numera feitas por este
  Hub usavam a **anon key** (`src/lib/supabase/numera-cliente.ts`),
  confiando na RLS de lá estar aberta (`qual: true`) — assim que o PR5
  fechar a RLS de verdade, essas 3 telas parariam de funcionar sem essa
  mudança.
  - `src/lib/dados/numera.ts` (`listarUsuariosNumera`, alimenta
    Configurações → Numera/Importar), `src/lib/dados/login-direto.ts`
    (`contarAdocaoNumera`, alimenta o card Numera de Configurações →
    Login direto) e `src/lib/dados/solicitacoes.ts`
    (`listarDocumentosNumera`, alimenta o formulário de solicitação de
    acesso) passaram a usar `criarClienteNumeraAdmin()`
    (`src/lib/supabase/numera-admin.ts`, service_role, já existia e já
    era usado por `aprovarNumera`/os 2 endpoints `/api/numera/*`) em vez
    do cliente anon.
  - `src/lib/supabase/numera-cliente.ts` (cliente anon) e `envNumera()`/
    `NUMERA_SUPABASE_ANON_KEY` (`src/lib/env.ts`) **removidos** — ficaram
    sem nenhum chamador depois da troca; a variável `NUMERA_SUPABASE_
    ANON_KEY` pode ser removida da Vercel quando o dono quiser (não
    quebra nada continuar lá, só não é mais lida).
  - **`aprovarNumera` parou de gravar senha** (`src/lib/actions/
    provisionamento-modulos.ts`): `payload.password = crypto.randomUUID()`
    virou `payload.password = ""`. A credencial de verdade já mora em
    `auth.users` (criada por `encontrarOuCriarConta`, que já roda antes);
    a coluna `password` de `public.users` é `NOT NULL` sem default, então
    o upsert ainda precisa de **algum** valor quando a linha é criada na
    hora (não quando já existe, criada pelo trigger `criar_perfil_usuario`
    do PR1 no projeto do Numera) — usa a mesma string vazia que esse
    próprio trigger já grava como placeholder para contas nascidas só
    pela Admin API (mesma convenção nos dois lados, documentada no
    comentário da função do trigger). Fecha o motivo de PR6 existir
    (apagar as senhas em texto puro): esta era a única gravação nova de
    senha ainda acontecendo depois do PR3.
  - Verificado: `tsc`/`eslint`/`vitest` (10 testes)/`next build` limpos.
    **Não testado ponta a ponta** (mesma limitação de sempre — sandbox
    sem acesso a `*.vercel.app`/`*.supabase.co`); confiança adicional:
    o `service_role` do Numera já tem GRANT completo em `public` desde a
    correção do PR2 (`20260928215347_fix_grant_service_role_tabelas_
    public.sql`), então as 3 leituras novas não deveriam topar com
    `permission denied` — mas o roteiro manual do dono (abrir
    Configurações → Numera/Importar, → Login direto, e aprovar uma
    solicitação de teste com o módulo Numera marcado) continua sendo o
    critério de pronto real antes de considerar o PR5 liberado.

## Bug real: aprovação de solicitação com vários módulos era tudo-ou-nada

Relato do dono: ao liberar Requerimentos para alguém que só tinha Compras,
"apareceram todos" os módulos. Investigação (consulta direta em
`hub.acessos_modulo`/`hub.solicitacoes_acesso`, só leitura):
`hub.definir_acesso` faz `delete` + `insert` do conjunto exato recebido —
não há união/soma escondida ali, confirmado lendo a função. O bookkeeping
de `aprovarSolicitacao` (`sincronizarBookkeepingHub`) também está correto
(só inclui módulos com `resultados[m].sucesso`). A concessão direta
(`definirAcesso`, Configurações → Usuários) também está correta: os
checkboxes de módulo (`modulos`) são independentes entre si.

**O bug real estava em `FormularioDecisaoModulos`**, usado por
`PainelSolicitacoes` (aprovação/reabertura de solicitação): o conjunto de
módulos decididos era sempre `modulosVisiveis` (= `solicitacao.
modulos_solicitados`, o que a PESSOA marcou no formulário público em
`/solicitar-acesso`) — sem nenhum jeito de o admin excluir um deles da
decisão. Isso significa duas coisas ruins, achadas juntas:
1. **Solicitação nova com vários módulos pedidos**: o admin só podia
   aprovar TODOS de uma vez (clicar "Aprovar" decide os 3) ou recusar
   tudo — sem meio-termo. Confirmado no banco: há uma solicitação
   pendente real agora (Ana Carolina Marinho Pacheco) pedindo os 3
   módulos ao mesmo tempo, exatamente o caso que travava.
2. **Reabrir uma solicitação já decidida (aba "Decididas", ex.: para
   corrigir um módulo que falhou)**: como `modulosVisiveis` nunca muda
   (é sempre o pedido original), reabrir para consertar SÓ um módulo
   reprocessava os outros dois também — inofensivo quando o outro módulo
   já tinha dado certo antes (reprocessar é idempotente), mas silenciava
   qualquer intenção do admin de NÃO conceder um módulo específico ainda.
   **Suspeita mais provável do caso relatado**: a pessoa provavelmente já
   tinha Numera de uma aprovação anterior (não veio de uma solicitação —
   não há registro em `hub.solicitacoes_acesso` para os dois usuários
   mais prováveis, Leandra Delgado e Majella, ambas com os 3 módulos hoje
   via concessão direta em sessões anteriores) e o checkbox de Numera já
   vinha marcado ao abrir o formulário de edição; sem uma forma de ver
   "isso já tinha, isso é novo" claramente separada, pareceu que os 3
   apareceram juntos quando só Requerimentos era de fato novo.

**Corrigido**: `FormularioDecisaoModulos` ganhou um checkbox "Incluir X
nesta decisão" por módulo (só aparece quando há mais de 1 módulo visível
— o caso comum de 1 módulo só continua sem nenhuma mudança visual),
desmarcado exclui o módulo de `decisoes` por completo (não entra em
`resultados`, não é reprocessado, não é gravado no bookkeeping). Todos
vêm marcados por padrão (mesmo comportamento de antes quando só há 1
módulo). Adicionado também: `aprovarSolicitacao` grava no resumo
(`observacao_decisao`) "não incluído nesta decisão" para módulos pedidos
mas deixados de fora — antes o resumo simplesmente omitia esses módulos,
escondendo que a solicitação ainda não estava 100% resolvida; e o badge
"Parcial" na lista de decididas agora também dispara para esse texto (não
só para "falhou"), porque nos dois casos ainda falta decisão.
Validação (`valido`) passou a exigir pelo menos 1 módulo incluído.
Verificado com `tsc`/`eslint`/`vitest`/`next build`, todos limpos. **Não
testado visualmente num navegador** (mesma limitação de sempre — sandbox
sem acesso a `*.vercel.app`).

## Bug real: `aprovarNumera` falhava ao atualizar um usuário JÁ EXISTENTE no Numera

Achado ao vivo pelo dono (print do erro, caso real de Ana Carolina Marinho
Pacheco): aprovar o módulo Numera de uma solicitação para alguém que **já
tinha conta lá** (ela já aparecia com o módulo Numera no Hub antes desta
aprovação) falhava com `null value in column "username" of relation
"users" violates not-null constraint` — mesmo a linha já existindo, sem
nenhuma tentativa de criar uma nova.

**Causa raiz, confirmada reproduzindo o erro exato no banco antes de
corrigir**: `aprovarNumera` usava `numeraAdmin.from("users").upsert(payload,
{onConflict:"id"})`, e só incluía `username`/`password` no `payload`
quando `!existente` (linha ainda não existia). Parecia seguro — quando a
linha já existe, o upsert vai fazer `UPDATE`, que não precisa tocar
`username`/`password` mesmo. **Mas não é assim que o Postgres avalia
`INSERT ... ON CONFLICT DO UPDATE`**: a parte `INSERT` do comando monta a
linha candidata (e valida NOT NULL/defaults dela) **antes** de decidir se
vai aplicar o insert ou desviar para o update por causa do conflito — ou
seja, omitir uma coluna NOT NULL sem default do `payload` quebra o
comando inteiro mesmo quando o resultado final seria só um `UPDATE`.
`username` e `password` em `public.users` (projeto do Numera) são as
duas colunas NOT NULL sem default deste payload.

**Corrigido**: trocado o `upsert` por dois caminhos explícitos —
`update()` (sem `username`/`password`, exatamente como já era a intenção)
quando `existente`, `insert()` (com `username`/`password` computados,
como antes) só quando a linha não existe. Mesmo resultado final, sem
depender dessa armadilha do `upsert`. Bug pré-existente desde antes do
PR4 (a condição `if (!existente)` já estava assim; o PR4 só mudou o QUE
era atribuído a `password` dentro dela, não a condição) — só não tinha
aparecido ainda porque nenhuma solicitação real tinha caído nesse caminho
específico (aprovar Numera para alguém que já tem conta lá) até agora.
**Reproduzido e confirmado corrigido transacionalmente** no banco do
Numera antes de publicar: o upsert antigo reproduz `null value in column
"username"...` byte a byte igual ao erro real; o update novo funciona sem
tocar `username`/`password`, preservando os valores existentes.
`tsc`/`eslint`/`vitest`/`next build` limpos.

## Bug real: usuária de outro app "não conseguia acesso" — foi parar na tela errada

Relato do dono: Lídia (conta só de Numera/Hub) "não conseguia acesso pelo
hub" e "tentou redefinir a senha e não deu certo". Investigação por
consulta direta (só leitura, `nfijlzndlioefayctbsh` e `uxdjhdnsnditivvjktzf`)
mais `query_logs` (`auth_logs` dos dois projetos) reconstruiu a timeline
exata — **nenhum dos dois backends estava quebrado**:

- `hub.usuarios`: conta criada 22/09, senha existe, **`last_sign_in_at`
  nulo** — ela nunca conseguiu entrar no Hub nem uma vez.
- `hub.acessos_modulo`: módulo `numera` concedido, sem `solicitacoes_
  acesso` correspondente (concessão direta, não fluxo de solicitação).
- Numera (`uxdjhdnsnditivvjktzf`): conta `approved=true`, `ativo=true`,
  senha real funcionando (logins com `grant_type: password`, status 200,
  confirmados nos `auth_logs` de lá).
- **A causa real**: os logs do projeto `nfijlzndlioefayctbsh` mostram
  3 pedidos de recuperação (`user_recovery_requested`, `/recover`) e os
  cliques no link (`/verify`, 303) todos com `referer:
  https://app-compras-brown.vercel.app` — ela foi parar na tela de
  "esqueci minha senha" do **Compras**, não do Hub nem do Numera. Como
  Hub e Compras compartilham o MESMO `auth.users` (mesmo projeto
  Supabase, só schemas diferentes), a troca de senha ali **funciona
  de verdade** (`updateUser` não sabe nem precisa saber em qual app a
  pessoa tem cadastro) — só que ela não tem `public.usuarios` (schema do
  Compras) nenhum, então ao tentar logar em seguida caía em "Usuário
  autenticado, mas sem cadastro na plataforma. Contate o administrador."
  **Sem nenhuma pista de que o problema era estar no site errado** — daí
  ela reportar que a redefinição "não funcionou".
- A senha do Numera (projeto à parte) é **completamente independente**
  dessa troca — nada no Compras/Hub afeta ela. `public.users.password`
  (legado, texto puro) segue com o valor antigo, mas não é mais lido pra
  autenticar desde o PR3 (`auth-service.js`, já publicado) — irrelevante
  aqui.

**Corrigido a classe do bug, nos dois lados** (não só o caso dela): quando
o Supabase Auth autentica mas não há cadastro no app local, em vez do
texto genérico único, checa (com o token de sessão já emitido, respeitando
as policies de "leio meu próprio cadastro" — nunca como leitura anônima)
se a pessoa tem cadastro em outro app do MESMO projeto Supabase, e avisa
qual usar:
- **App-Compras** (`src/lib/actions/auth.ts`, `sugestaoHubSeExistir`):
  checa `hub.acessos_modulo` via `criarClienteHubComSessao` (nova função em
  `src/lib/supabase/hub-cliente.ts`, mesmo cliente mínimo já usado pelo
  bloqueio de login direto, só que carregando o `access_token` da sessão
  recém-autenticada em vez de anônimo) — lista os módulos e aponta a URL
  do Hub (`URL_CENTRAL_CATAGUASES`, extraída para `src/lib/constantes/
  hub.ts` para não duplicar com `login/page.tsx`).
- **Hub** (`src/lib/actions/auth.ts`, `sugestaoOutroAppSeExistir`): checa
  `public.usuarios` (Compras) e `requerimentos.usuarios` via a mesma
  ideia (`criarClienteSchemaComSessao`, novo, `src/lib/supabase/schema-
  com-sessao.ts`) e devolve nome + URL de cada um encontrado, usando o
  catálogo `MODULOS` já existente.
- **Numera é projeto à parte** (`uxdjhdnsnditivvjktzf`) — não dá pra
  checar por essa via (não compartilha `auth.users`); fora do alcance
  desta correção, que cobre só o trio que já divide um projeto Supabase.
- Roda só DEPOIS de senha já validada (não é consulta de enumeração —
  quem chega até aqui já provou que é dono da conta), timeout curto por
  schema consultado, qualquer falha (rede, RLS, schema fora do ar) cai no
  texto genérico de sempre — nunca faz o diagnóstico atrapalhar o caminho
  de erro comum ("e-mail ou senha incorretos" continua intocado).
- **A conta de Lídia em si não foi alterada** — mecanicamente ela já
  funciona nos dois backends (Hub tem senha própria nunca usada; Numera
  tem senha real confirmada funcionando). A orientação passada ao dono:
  ela deve usar "esqueci minha senha" na tela de login do **Numera**
  (`https://app-numera-o-de-docs.vercel.app`), não do Compras — esse
  fluxo já está confirmado funcionando de ponta a ponta (bypass Brevo,
  testado com e-mail real nesta mesma sessão) e vai dar a ela uma senha
  que ela mesma escolhe, sem precisar de nenhuma intervenção manual no
  banco. Não gravei/enviei nenhuma senha por ela — o sandbox de
  desenvolvimento não alcança `*.vercel.app`/`*.supabase.co` para disparar
  o endpoint por ela mesmo se quisesse, e criar uma senha às cegas sem
  ela saber não resolveria nada.
- Verificado: `tsc`/`eslint`/`vitest`/`next build` limpos nos dois repos
  (Compras: 236 testes; Hub: 10 testes). **Não testado visualmente num
  navegador** (mesma limitação de sempre).

## Transparência de módulos na página inicial: mostra todos, trava os sem acesso

Pedido do dono a partir do caso da Lídia: "quando a pessoa não tem acesso a
algum app, deve aparecer em transparência no hub e não permitir tentar
acesso". Antes, `listarMeusModulos` só devolvia os módulos JÁ liberados —
a página inicial simplesmente **escondia** os outros por completo. Dois
problemas nisso: (1) ninguém sabia que um módulo existia para poder pedir
acesso a ele (nada de transparência), e (2) mesmo assim nada impedia
alguém de digitar a URL de um app direto (bookmark antigo, link
compartilhado) e tentar logar onde não tem cadastro — exatamente a classe
de confusão já corrigida na entrada anterior deste arquivo ("tentei por
um, era por outro").

- `src/lib/dados/modulos.ts`: `listarMeusModulos` → `listarModulosComAcesso`,
  devolve **todo** o catálogo `MODULOS` (não só os liberados), cada item
  com `temAcesso: boolean`. Única chamadora era `src/app/page.tsx`.
- `src/app/page.tsx`: todo módulo aparece como card, sempre. Com acesso:
  o card de sempre, linkando pro app. **Sem acesso**: card visualmente
  travado (borda tracejada, opacidade reduzida, ícone de cadeado) que
  **não linka para o app** — linka para `/solicitar-acesso?modulo=<chave>`.
  Nunca deixa a pessoa "tentar" um login onde não tem cadastro.
- `/solicitar-acesso` (`page.tsx` + `SolicitarAcessoForm`): passou a
  aceitar `?modulo=` (pré-marca o checkbox do módulo pedido) e, se a
  pessoa já está logada no Hub (veio do card travado, não de fora),
  pré-preenche nome/e-mail a partir da própria sessão — a mesma
  `solicitarAcesso()` de sempre já aceitava chamada autenticada
  (comentário já dizia isso), só a UI não aproveitava. Continua
  funcionando igual para quem chega de fora sem sessão nenhuma (o
  cadastro-zero original).
- **Não implementado ainda, registrado para decisão futura**: o pedido
  também citou "muitos logins... login pro hub e depois pra cada app" —
  hoje não há SSO real nenhum entre os 4 apps (3 deles dividem o mesmo
  `auth.users`, mas cada um pede a senha de novo; Numera é projeto
  separado de verdade). Dá pra eliminar boa parte disso com um "abrir com
  um clique" via `generateLink({type:'magiclink'})` no momento do clique
  no card (o Hub já tem `service_role` do projeto compartilhado E do
  Numera — service_role de ambos já usados hoje para outras coisas):
  gera o link autenticado como a própria pessoa, na hora, e manda o
  navegador direto pra lá já logado, sem pedir senha de novo. Ficou de
  fora desta entrega por ser mudança de superfície bem maior (mexe no
  fluxo de entrada dos 3 apps de destino, não só do Hub) e mais sensível
  (qualquer bug aqui é bug de autenticação) — feita só se o dono confirmar
  que quer, com tempo pra desenhar/testar direito.
- Verificado: `tsc`/`eslint`/`vitest` (10 testes)/`next build` limpos.
  **Não testado visualmente num navegador** (mesma limitação de sempre).

## SSO por magic link ao abrir um módulo

Pedido do usuário, na sequência direta da transparência de módulos acima
("Confirme como funcionará o sistema de login que sugeriu e prossiga"):
elimina a segunda senha ao abrir Compras/Requerimentos/Numera pelo Hub, sem
inventar SSO real de sessão entre projetos Supabase (dois deles nem
compartilham o mesmo projeto — não dá).

- **`src/lib/actions/sso.ts` (`abrirModulo(modulo)`)**: cada card de módulo
  LIBERADO na home (`src/app/page.tsx`) virou um `<form action={abrirModulo
  .bind(null, m.chave)}>` em vez de um `<a href>` comum. No clique, a
  action confirma de novo (defesa em profundidade — a UI já só mostra os
  liberados) que a sessão atual tem acesso ao módulo
  (`hub.acessos_modulo`/`admin_hub`), chama
  `generateLink({type:"magiclink", email: <e-mail da PRÓPRIA sessão do
  Hub>, options:{redirectTo}})` — nunca aceita e-mail vindo do cliente,
  pra ninguém conseguir gerar link pra conta alheia — e redireciona o
  navegador DIRETO pro `action_link` que o Supabase devolve. Compras e
  Requerimentos (mesmo projeto Supabase, `nfijlzndlioefayctbsh`) usam
  `criarClienteAdminBruto()` (já existente); Numera (projeto à parte) usa
  `criarClienteNumeraAdmin()` (já existente, mesmo client já usado no
  bypass de recuperação de senha do Numera). Link gerado NA HORA a cada
  clique — nunca cacheado nem persistido — e de uso único, pelas regras
  padrão do próprio Supabase Auth.
- **Página de destino em cada app**: `redirectTo` aponta pra
  `/auth/entrar-via-hub` (Compras e Requerimentos — página de CLIENTE
  nova nos dois repos, `criarClienteNavegador`/`detectSessionInUrl`
  processa o fragmento da URL sozinho, mesmo mecanismo já validado na
  correção do link de recuperação de senha) ou pra raiz `/` do Numera
  (não precisou de página nova — a raiz de lá já processa o fragmento do
  mesmo jeito, comportamento que a recuperação de senha do Numera já
  usa).
- **Falha nunca trava o acesso**: se `generateLink` falhar por qualquer
  motivo (erro da API, ou a chave `service_role` do Numera não configurada
  nesta implantação), a action cai pro link direto de sempre
  (`redirect(info.url)`) — só perde o atalho de SSO, não perde o acesso ao
  módulo.
- **Bug real no primeiro uso, ação pendente do usuário (não é bug de
  código)**: clicar em "Requerimentos" no Hub abriu o Compras. Reproduzido
  via `auth_logs` do projeto compartilhado (`nfijlzndlioefayctbsh`):
  `POST /admin/generate_link` seguido de `GET /verify` com `status 303`
  (redirecionamento OK, sem erro nenhum) — comportamento padrão do GoTrue
  (Supabase Auth) quando o `redirect_to` pedido não está na allow-list de
  "Redirect URLs" do projeto: em vez de falhar, ele silenciosamente cai
  pra `Site URL` configurada. Esse allow-list foi configurado (item A2 do
  guia de implantação) só para o domínio do Compras, quando só o Compras
  existia como consumidor de redirect da Auth deste projeto — Requerimentos
  nunca foi adicionado. **Não corrigível por código**: a allow-list vive só
  no painel do Supabase (Authentication › URL Configuration › Redirect
  URLs, mesmo caminho já usado no A2), sem tool de MCP que a exponha.
  **Ação pendente do usuário**: adicionar
  `https://app-requerimentos-camara.vercel.app/**` (e, se algum dia o
  Hub também virar destino de um redirect, a própria URL dele) àquela
  lista. Numera não precisa de mudança — projeto Supabase à parte, com o
  próprio Site URL/allow-list já configurado para o domínio dele (mesmo
  que a recuperação de senha de lá já usa).
- Testado: `tsc`/`eslint`/`npm test` (10 testes) e `next build` verdes nos
  três repos (Hub, Compras, Requerimentos). **Não testado ponta a ponta
  entre apps de verdade** (sandbox não alcança `*.vercel.app`) — cada
  metade (geração do link aqui, consumo do fragmento lá) reaproveita
  mecanismo já validado separadamente; falta só confirmar o fluxo
  completo no deploy.

## Login unificado: SSO silencioso, não só no clique

Pedido do usuário, na sequência direta do SSO por clique acima: "quero que a
pessoa faça login pelo hub e que esse login já libere a pessoa a entrar
direto no app... sem precisar fazer login em cada app". Decisão confirmada
via `AskUserQuestion`: quando ninguém está logado em lugar nenhum, a tela
de login que aparece é a do **Hub**, não a do app — login único, sempre no
mesmo lugar (o usuário reforçou isso numa mensagem em seguida: "a tela de
login que deve aparecer é a do Hub", e adiantou a intenção de, mais pra
frente, desativar o login direto de cada app de vez — o toggle pra isso
**já existe**, `esta_bloqueado_login_direto`/Configurações → Login direto
por aplicativo, criado antes deste SSO silencioso existir; não precisa de
toggle novo).

- **`GET /sso/silencioso?app=<modulo>&proximo=<caminho>`**
  (`src/app/sso/silencioso/route.ts`): cada app, ao NÃO achar sessão
  própria — inclusive entrando DIRETO pela URL do app, sem nunca ter
  passado pelo Hub —, navega pra cá (página inteira, nunca `fetch`: o
  cookie de sessão do Hub é first-party só numa navegação de verdade;
  um `fetch` cross-origin não o enviaria, e mesmo enviando esbarraria em
  CORS) antes de mostrar o próprio formulário de senha:
  - **Sessão do Hub válida + acesso ao módulo** → gera o link mágico de
    uso único (mesmo núcleo de `abrirModulo`, extraído pra
    `src/lib/sso/gerar-link.ts`: `gerarLinkSso(usuario, modulo, proximo?)`,
    usado pelos dois — clique e silencioso — pra não duplicar a regra de
    segurança) e manda o navegador direto pro app, autenticado.
  - **Sem sessão nenhuma (nem no Hub)** → redireciona pro `/login` do
    **Hub**, com `proximo=/sso/silencioso?app=X&proximo=Y` — depois de
    logar aqui, volta pra esta rota, que agora acha a sessão e completa o
    SSO. Nunca mostra formulário de senha de app nenhum quando ninguém
    está logado em lugar algum, por decisão do usuário.
  - **Sessão do Hub válida mas SEM acesso ao módulo, ou falha ao gerar o
    link** → devolve pro `/login` do PRÓPRIO app, com `ssoFalhou=1`
    (guarda de loop: aquele app não tenta a checagem de novo) — nunca
    trava: quem tem conta direta nesse app fora do Hub ainda consegue
    entrar por ela.
- **Cada app precisa de duas mudanças pra participar** (feitas nos três):
  1. `/login` (Next.js) ou o boot da SPA (Numera) redireciona pra cá
     sempre que não há sessão E não há `ssoFalhou=1`/`motivo` já
     preenchido (esse último sinaliza que o SERVIDOR já tem algo
     específico pra mostrar — conta desativada, link expirado — e
     mostrar isso importa mais que tentar de novo; sem essa exceção,
     "conta desativada" entraria em loop, porque o Hub não sabe do
     `ativo` específico de cada app).
  2. `sair()`/`handleLogout()` passa a redirecionar pro próprio `/login`
     com `ssoFalhou=1` em vez de um `/login` limpo — sem isso, "Sair"
     tentaria a checagem silenciosa de novo e, com a sessão do Hub ainda
     de pé, relogaria na hora (o botão pareceria não funcionar). Sair é
     LOCAL (só daquele app); pra sair de tudo, a pessoa usa o "Sair" do
     próprio Hub — mesma semântica de qualquer SSO (sign-out do serviço
     ≠ sign-out do provedor de identidade), não perguntado, mas o default
     de menor surpresa e fácil de mudar depois se pedirem.
- **Numera** (SPA sem rotas de URL, `checkAutoLogin()`/`tentarSsoSilenciosoOuMostrarLogin()`
  em `app.js`): mesmo mecanismo, sem `proximo` (não há "caminho" pra
  preservar numa SPA cujo estado de tela vive em JS, não na URL).
  `handleLogout()` passou a fazer uma navegação de verdade
  (`window.location.href`) em vez de só re-renderizar em memória — só
  assim dá pra gravar `ssoFalhou=1` na URL (sem isso, um F5 logo depois
  do "Sair" cairia no mesmo problema do item acima).
- **Achado de segurança de carona, corrigido nos 3 repos com CLAUDE.md**
  (App-Compras, `centraltech`; Requerimentos idem, sem entrada própria
  aqui): a auditoria de open redirect (ver "Auditoria de segurança
  completa da plataforma" no CLAUDE.md do App-Compras) tinha corrigido
  `/auth/confirm/route.ts` nos 3 repos, mas **não** a função homônima
  dentro de `entrar()` (`src/lib/actions/auth.ts`) do Hub e do
  App-Compras — mesmo filtro ingênuo (`startsWith("/") &&
  !startsWith("//")`), mesmo bypass (`/\evil.com`), só que alcançável
  pelo campo oculto `proximo` do formulário de login em vez do link de
  e-mail. Achado ao escrever a validação de `proximo` num TERCEIRO lugar
  (`/sso/silencioso` e `/auth/entrar-via-hub`) e notar que `entrar()`
  ainda usava o padrão antigo. Corrigido extraindo
  `src/lib/seguranca/destino-seguro.ts` (a versão já corrigida,
  reaproveitada por `/auth/confirm`, `entrar()` e `/sso/silencioso`) —
  Requerimentos já tinha essa correção em `entrar()` desde a auditoria
  original (só não estava extraída; extraída agora pelo mesmo motivo:
  `/auth/entrar-via-hub` precisa dela também).
- Testado: `tsc`/`eslint`/`npm test` e `next build` verdes nos três repos
  Next.js (Hub, Compras, Requerimentos); `node --check` no `app.js` do
  Numera (sem framework de build/lint lá). **Não testado ponta a ponta
  entre apps de verdade** (sandbox não alcança `*.vercel.app`) — mesma
  limitação de sempre.

## Interruptor de login direto habilitado para o Numera

Achado ao revisar `PainelLoginDireto` (Configurações → Login direto por
aplicativo) depois do SSO silencioso acima: o comentário/UI dali dizia que
Numera "não tem substituto de login pelo Hub" e por isso o interruptor de
bloqueio só aparecia pra Compras/Requerimentos — verdade quando foi escrito
(antes do SSO existir), **falsa agora**: o Numera já tem os dois caminhos
de SSO (clique em `abrirModulo` e a checagem silenciosa em
`/sso/silencioso?app=numera`), então bloquear o login direto dele deixou
de significar "ninguém mais entra".

- **`alternarBloqueioLoginDireto`** (`src/lib/actions/login-direto.ts`):
  continua gravando em `hub.config_modulo` via
  `definir_bloqueio_login_direto` (RPC já existente, sempre aceitou
  qualquer `Modulo`) — mas quando `modulo === "numera"`, agora TAMBÉM
  escreve `app_config.loginDiretoBloqueado` no projeto SEPARADO do Numera
  (`criarClienteNumeraAdmin()`, já usada para outras escritas
  cross-projeto, como a criação de conta na aprovação de solicitação de
  acesso). Necessário porque o app do Numera (`app.js`,
  `checkAutoLogin()`/`showLoginView()`) lê essa flag do PRÓPRIO banco dele,
  não do `config_modulo` do Hub — os dois projetos não se enxergam.
  **Sem transação cross-projeto de verdade** (impossível entre dois
  bancos Supabase distintos): grava no Hub primeiro, Numera depois; se o
  segundo falhar, devolve erro explícito ("Gravado no Hub, mas falhou ao
  espelhar no projeto do Numera") em vez de mascarar a inconsistência.
- **`PainelLoginDireto`**: `InterruptorBloqueio` passa a renderizar pros
  3 módulos (antes só Compras/Requerimentos, com um parágrafo explicando
  por que Numera não tinha); o Numera ganha só uma nota informativa
  (grava em dois lugares) em vez do texto antigo, que estava desatualizado.
- **Achado de segurança, já documentado, não é novo**: `public.app_config`
  no projeto do Numera tem RLS **totalmente aberta**
  (`using (true) with check (true)`, `schema.sql` linha 81) — mesmo
  problema já registrado no CLAUDE.md do próprio Numera com prioridade
  máxima ("RLS totalmente aberta + senha em texto puro"). A escrita desta
  action usa `service_role` (ignora RLS de qualquer jeito), então não é
  afetada por essa falha, mas registrado aqui para não parecer que o
  achado foi descoberto agora — é o mesmo de sempre.
- Verificado: `tsc`/`eslint`/`npm test` (10 testes) e `next build` verdes.
  **Não testado ponta a ponta** (sandbox não alcança `*.vercel.app`/
  `*.supabase.co`) — a lógica de escrita dupla é direta o bastante (dois
  `upsert`/RPC sequenciais, cada um já usado isoladamente em produção) pra
  não precisar de mock; falta só confirmar no deploy que o toggle do
  Numera realmente aparece e funciona nos dois sentidos.

- **Bug real de produção: loop infinito de login + link de primeiro
  acesso sem `redirectTo`** (relato do usuário via print: navegador preso
  em `localhost:3000/#access_token=...`, `ERR_CONNECTION_REFUSED`, ao
  tentar entrar pelo link do Hub). Investigação por `query_logs`
  (`auth_logs`, projeto compartilhado `nfijlzndlioefayctbsh`): um usuário
  real (`odomarribeiro@gmail.com`, conta e acesso ao Compras já válidos —
  não é problema de cadastro) preso gerando um magic link novo a cada
  8-40 segundos por 8 minutos seguidos, sempre com `referer` apontando
  pro `/auth/entrar-via-hub` do Compras e `/verify` retornando sucesso
  (303) a cada vez — o SSO "funcionava" a cada tentativa, mas algo sempre
  mandava o usuário de volta pro início.
  - **Duas causas encaixadas, uma corrigível aqui e outra não**:
    (1) suspeita forte, **não confirmável por nenhum tool desta sessão**:
    o `redirectTo` do magic link (`gerarLinkSso`,
    `https://app-compras-brown.vercel.app/auth/entrar-via-hub?proximo=...`)
    provavelmente não bate com nenhuma entrada da allow-list "Redirect
    URLs" do projeto Supabase compartilhado — sem match, o GoTrue ignora
    o `redirectTo` pedido e usa a "Site URL" do projeto, plausivelmente
    ainda o padrão de fábrica `http://localhost:3000` — exatamente o
    destino do print. Mesma classe de configuração já suspeita numa sessão
    anterior para o caso "clicar em Requerimentos abria o Compras".
    (2) bug de CÓDIGO, real e corrigido: em App-Compras e Requerimentos,
    `(protegido)/layout.tsx` fazia `redirect("/login")` sem flag quando
    não achava usuário — e a lógica de SSO silencioso de `/login`
    (construída nesta sessão) tenta autenticar de novo automaticamente
    sempre que a URL não tem `motivo`/`ssoFalhou=1`. Se o SSO "der certo"
    mas a sessão não for reconhecida de volta no layout por qualquer razão
    (a mais provável sendo justamente cair em `localhost` e nunca voltar),
    o resultado é um loop 100% automático — bate com o padrão observado.
    Corrigido nos dois repositórios (`App-Compras` PR #9, merged;
    `app-requerimentos-camara`, commit direto em `main`): todo
    `redirect("/login")` sem flag na área protegida agora usa
    `redirect("/login?ssoFalhou=1")`, mesmo guard que `sair()` já usava.
  - **A causa (1) não pode ser corrigida por código** — é configuração do
    painel do Supabase (Authentication → URL Configuration), sem nenhum
    tool nesta sessão para ler/escrever "Site URL"/"Redirect URLs".
    Repassado ao usuário: confirmar que "Site URL" não é mais
    `http://localhost:3000` (o mais coerente é apontar pra este Hub, já
    que é o "dono" das contas compartilhadas) e que "Redirect URLs" inclui
    pelo menos `https://app-compras-brown.vercel.app/**` e
    `https://<domínio do Requerimentos>/**` — coringas cobrem qualquer
    caminho/query string sem cadastrar um por um.
  - **Bug relacionado, mais antigo, corrigido aqui de carona**:
    `gerarLinkPrimeiroAcesso()` (`src/lib/actions/
    provisionamento-modulos.ts`, usada no link de primeiro acesso de quem
    é aprovado numa solicitação ou tem acesso concedido direto em
    Configurações) nunca passava `redirectTo` ao
    `generateLink({type:"invite"})` — dependia 100% da mesma "Site URL"
    (idem, possivelmente `localhost:3000`) pra saber pra onde mandar a
    pessoa no primeiro clique. `ClienteComAuthAdmin.generateLink` ganhou
    `options?: { redirectTo?: string }`; `gerarLinkPrimeiroAcesso` passou
    a exigir `redirectTo` do chamador. Conta compartilhada
    (Compras/Requerimentos/Hub, mesmo `auth.users`): aponta pra
    `/redefinir-senha` **deste** Hub — reaproveita a mesma página de
    CLIENTE que já trata o fragmento `#access_token=...` da recuperação de
    senha via `GuardaRecuperacao` (um link de invite usa o mesmo mecanismo
    de token único no fragmento), funciona independente de quais módulos
    exatos foram concedidos porque é uma senha só, compartilhada. `origem
    DaRequisicao()` (antes privada em `auth.ts`) foi exportada para os dois
    call sites (`solicitacoes.ts`, `configuracoes.ts`) reaproveitarem, em
    vez de duplicar o cálculo de protocolo+host. Numera (projeto à parte):
    aponta pra `MODULOS.numera.url` (a raiz do app) — mesma convenção já
    usada em `gerar-link.ts` (`DESTINO_SSO.numera`), mas **sem resolver o
    gap estrutural já conhecido**: o `app.js` do Numera só escuta o evento
    `PASSWORD_RECOVERY`, não `SIGNED_IN` genérico, então um convite
    (`type: "invite"`) pode não disparar a tela de definir senha lá — não
    corrigido nesta rodada por exigir mudança no próprio `app.js` do
    Numera e não ter evidência de que este incidente específico passou por
    esse caminho (a conta do usuário afetado já existia há 16 dias — isto
    é sobre convites de conta NOVA).
  - Verificado: `tsc`/`eslint`/`npm test` e `next build` verdes nos 3
    repositórios (Compras, Requerimentos, Hub). **Não verificado ponta a
    ponta no navegador** (sandbox não alcança `*.vercel.app`/
    `*.supabase.co`) — a correção do guard `ssoFalhou=1` quebra o loop por
    construção, mas a causa-raiz de fábrica (Site URL/Redirect URLs) só o
    usuário pode confirmar e corrigir no painel do Supabase.

- **Quatro usuários, três barreiras (Lídia entra; Odomar, Alexandre e Junia
  não) — SSO e primeiro acesso deixam de depender do `/verify` do GoTrue.**
  Diagnóstico pelos `auth_logs` dos DOIS projetos: o campo `referer` de lá é
  o destino que o GoTrue aceitou após conferir a allow-list (ou a Site URL,
  quando recusa). O projeto do **Numera** registra `http://localhost:3000`
  em todo evento (Site URL de fábrica, domínio do app fora da allow-list) —
  foi dali o print de `localhost:3000`, não do projeto compartilhado como
  suposto no item anterior.
  - **Lídia**: entra direto no Numera com a senha dela — sem redirect, OK.
  - **Odomar**: Hub → Numera caía em localhost (~40 cliques entre 10:24 e
    11:23). Hub → Compras também nunca gravava a sessão: o
    `createBrowserClient` do `@supabase/ssr` usa fluxo PKCE, que recusa
    `#access_token=` no fragmento ("Not a valid PKCE flow url").
  - **Alexandre e Junia**: sabem a senha do Numera (conferido comparando o
    hash de `auth.users` de lá com a senha legada, sem expor nada), mas a
    conta do Hub foi criada por `encontrarOuCriarConta` com senha aleatória,
    e o link de primeiro acesso nunca existiu: `generateLink({type:
    "invite"})` para e-mail que acabou de ser criado é recusado pelo GoTrue.
  - **Correções**:
    - `gerarLinkSso` (`src/lib/sso/gerar-link.ts`): usa só o
      `hashed_token`. Compras/Requerimentos → `{app}/auth/confirm?
      token_hash=...&type=magiclink&next=...` (o app valida no servidor com
      `verifyOtp` e grava cookie). Numera → o próprio Hub faz `verifyOtp` e
      redireciona com a sessão no fragmento (`urlComSessaoNoFragmento`,
      mesmo formato do GoTrue; o Numera usa cliente implícito, aceita).
    - `/api/numera/abrir-link` (novo, público pelo prefixo `/api/numera/`):
      destino dos e-mails de recuperação do Numera e do primeiro acesso de
      lá; valida o token no servidor e entrega `type=recovery` ao Numera
      (dispara a tela de definir senha, `PASSWORD_RECOVERY`).
    - `gerarLinkPrimeiroAcesso`: `invite` → `recovery` (vale para conta já
      existente) + `montarLink` (`linkPrimeiroAcessoHub` → `/auth/confirm`
      do Hub com `next=/redefinir-senha`; `linkPrimeiroAcessoNumera` →
      `/api/numera/abrir-link`).
    - `alinharSenhaComNumera` (`src/lib/auth/senha-numera.ts`), chamada por
      `entrar()` quando a senha falha: se a conta do Hub existe, está ativa
      e **nunca fez login** (`last_sign_in_at` nulo — ainda com a senha
      aleatória), e o Numera aceita a mesma senha para o mesmo e-mail com
      conta aprovada, grava essa senha no Hub e tenta de novo. Nunca mexe
      em conta já usada (não sobrescreve senha de Compras/Requerimentos).
      A sessão aberta no Numera para conferir é encerrada com `scope:
      "local"` (o padrão `global` derrubaria as sessões da pessoa lá).
  - Nada disso depende mais da Site URL/Redirect URLs dos projetos. Continua
    valendo corrigir o painel do Numera (Site URL = domínio do app) por
    higiene, e incluir `https://app-requerimentos-camara.vercel.app/**` na
    allow-list do projeto compartilhado para o "esqueci a senha" do
    Requerimentos (o do Compras foi contornado no próprio app).
  - Verificado: `tsc`/`eslint`/`npm test`/`next build` verdes. **Não
    testado ponta a ponta** (sandbox não alcança `*.supabase.co`/
    `*.vercel.app`); conferir nos `auth_logs` após o deploy.

- **Auditoria de todos os cadastros (58 no projeto compartilhado, 42 no
  Numera) atrás das mesmas barreiras.** Cruzamento por e-mail entre
  `auth.users`/`hub.usuarios`/`hub.acessos_modulo`/`public.usuarios`/
  `requerimentos.usuarios` e `auth.users`/`public.users` do Numera, com a
  senha do Numera conferida contra a legada via `crypt()` (sem expor nada).
  - 29 contas do Hub nunca fizeram login (senha aleatória do
    provisionamento). 27 têm conta aprovada no Numera com o mesmo e-mail e
    senha conhecida → cobertas por `alinharSenhaComNumera`. As outras:
    **Majella** (a senha "legada" dela no Numera tem 36 caracteres — é o UUID
    aleatório do próprio provisionamento, e nem bate com o `auth.users` de
    lá: não conhece senha nenhuma em lugar nenhum) e
    `serv.contratos@cataguases.teste` (conta de teste ativa, nunca usada).
  - Único recurso para quem não conhece senha é o "esqueci a senha" do Hub
    — e ele também dependia do redirect do GoTrue: nenhum evento do projeto
    compartilhado jamais teve destino aceito no domínio do Hub, então o
    link caía na raiz do Compras, sem o cookie do verificador PKCE.
    `solicitarRecuperacao` passou a gerar o link pela Admin API, validar em
    `/auth/confirm` do próprio Hub e enviar pela Brevo (`enviarEmailBrevo`),
    com tempo mínimo de resposta (anti-enumeração).
  - Pendências de cadastro, não de código (decisão do dono): **Leandra**
    tem e-mail diferente no Hub (`leandraoliveiradelgado@`) e no Numera
    (`leandra.cataguases@`) → o clique em Numera no Hub não acha a conta
    dela lá; **Ludmila Fontoura** tem conta aprovada no Numera mas o Hub não
    lista o módulo; conta órfã no Auth do Numera com e-mail digitado errado
    (`barbosagabriel2004g@gmai.com`, sem perfil). Risco residual: 10 pessoas
    têm senha de 6 caracteres no Numera — se o projeto compartilhado exigir
    mais que isso, `updateUserById` recusa e elas precisam do "esqueci a
    senha" do Hub.

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

- **Feedback centralizado (01/10/2026).** Todo app grava em `hub.feedback`
  (migration `20261001000000`, já aplicada) com `app` = origem; quem gerencia
  é `hub.pode_gerir_feedback()` (admin do Hub OU admin/diretor do Compras).
  - **Envio**: apps do projeto compartilhado (Compras, Requerimentos, Hub)
    chamam a RPC `hub.enviar_feedback` com o token da sessão (app fixo
    nos apps; escolhido pela pessoa só no Hub). O Numera (outro projeto)
    manda para `/api/feedback` (CORS só para o domínio dele) com o token de
    lá, validado com a service_role do Numera; anexos vão para
    `numera/{uid}/...` no mesmo bucket `feedback-anexos`. Identidade vem
    sempre do token.
  - **Gestão** em `/feedback` (todos os apps, filtros, status novo/em
    análise/resolvido/não possível, selo de novos no header); qualquer pessoa
    vê "Meus envios" (histórico + status) — dentro de cada app também.
  - **Cor por app** (`src/lib/feedback/apps.ts` + `hub.apps_feedback`):
    compras #0D9488, requerimentos #C63B22, numera #0071e3, hub #E9A63B.
    **App novo = 1 linha em `hub.apps_feedback` + 1 entrada em `APPS_FEEDBACK`
    + megafone com o slug dele.**
  - A tabela antiga `public.feedback_usuarios` (Compras) ficou intacta; os
    registros foram copiados. Compras perdeu a rota `/feedback`.
  - Armadilha: DDL em `storage.objects` pelo `execute_sql` estoura o tempo
    limite; `apply_migration` com só o `create policy` funcionou.
- **Padrão de header (todos os apps)**: faixa de 3px no topo na cor do app;
  marca à esquerda; à direita, nesta ordem: megafone de feedback → ajuda →
  usuário → Sair. Hub e Requerimentos (header escuro) e Compras (claro, com
  barra lateral) seguem; o Numera ganhou um cabeçalho igual (marca, Central,
  megafone, ajuda, usuário, Sair) acima da barra lateral.

## Módulo Emendas Impositivas (4º módulo — roda DENTRO do Hub)

Pedido do dono: acompanhar e cadastrar as emendas impositivas dos vereadores
(antes numa planilha), com painéis, execução por etapas e permissão por
secretaria. Diferente dos outros 3, **não é um app separado**: rotas
`/emendas/*` deste repositório, mesma sessão (sem link mágico, sem segundo
login), schema próprio `emendas` no projeto compartilhado
(`nfijlzndlioefayctbsh`). Cor do módulo: violeta `#6B4FBB` (faixa de 3px no
cabeçalho; `CabecalhoHub` aceita `modulo={{nome, cor, app}}`). Mockup
aprovado pelo dono antes de construir (artifact "Emendas Impositivas —
Mockup"); a planilha original de 2026 serviu de modelo de dados.

- **Passo manual do dono (obrigatório)**: Supabase → Project Settings → API →
  *Exposed schemas* → adicionar `emendas`. Sem isso toda tela do módulo
  falha (PGRST106) e o bloco "Emendas" do formulário de acesso avisa
  "secretarias indisponíveis".
- **Banco** (`supabase/migrations/20261021*`): `exercicios` (cota por
  vereador, mínimo de Saúde), `vereadores`, `secretarias` (= unidade de
  PERMISSÃO), `unidades_orcamentarias` (02.09 Fundo de Saúde → Saúde),
  `beneficiarios`, `emendas`, `andamentos`, `movimentos_financeiros`,
  `impedimentos`, `remanejamentos` (antes/depois em jsonb), `documentos`
  (bucket privado `emendas-documentos`), `usuarios`/`permissoes`,
  `auditoria` (trigger genérico) e a view `v_emendas` (`security_invoker`).
  Regras no BANCO, não só na tela: soma por vereador ≤ cota (trigger +
  advisory lock), etapa × modalidade (`etapa_compativel_modalidade`:
  repasse tem plano de trabalho/prestação de contas, aplicação direta tem
  processo de compra), empenhado ≤ valor e pago ≤ empenhado (constraint
  trigger deferrable). Modalidade vem da natureza da despesa (3º grupo:
  50 = repasse; 90/91/93 = direta). Os 50% na Saúde são ALERTA, não bloqueio.
  `etapa` é cache mantido por trigger a partir de `andamentos`.
- **Perfis**: admin do Hub (acesso total) · `gestor` (tudo, inclusive valor/
  dotação/remanejamento/importação) · `admin_secretaria` (registra a execução
  da própria secretaria e ajusta a equipe dela) · `operador` · `consulta`.
  Para os três últimos, `emendas.permissoes(usuario, secretaria, pode_ver,
  pode_editar)` decide por secretaria (editar a própria, ver as outras ou
  não). RLS: `select` por `pode_ver_secretaria`; escrever execução por
  `pode_editar_emenda`; campos centrais só gestor; remanejamento e
  `definir_acesso` só por RPC. Funções de permissão são `security definer`
  com `revoke ... from public, anon` explícito (lição do cadastro unificado).
- **Telas nunca usam service_role** — `criarClienteEmendas()` (mesma sessão,
  schema `emendas`); quem decide o que cada pessoa vê é a RLS. Única exceção:
  `/emendas/configuracoes/usuarios` lê nome/e-mail em `hub.usuarios` com a
  service_role, só para ids que a RLS do módulo já liberou.
- **Integração com a Central**: `Modulo` ganhou `"emendas"`; `MODULOS.emendas`
  tem `interno: true` (`url: "/emendas"`; `gerarLinkSso` devolve o caminho,
  sem link mágico); `hub.acessos_modulo`/`solicitacoes_acesso` aceitam o novo
  valor; `hub.definir_acesso` desativa/reativa `emendas.usuarios.ativo` em
  cascata (mesma simetria de Compras/Requerimentos); `aprovarEmendas`
  (`provisionamento-modulos.ts`) grava perfil + permissões iniciais
  (secretaria própria + "vê as outras") via `emendas.definir_acesso`, e o
  `FormularioDecisaoModulos` ganhou o bloco Emendas; o ajuste fino por
  secretaria fica na matriz do próprio módulo. Emendas NÃO entra em
  `hub.config_modulo` (não tem login direto para bloquear). Feedback:
  linha em `hub.apps_feedback` + `APPS_FEEDBACK` (`#6B4FBB`), e o megafone
  de dentro do módulo já abre com "Emendas".
- **Código**: `src/app/emendas/*` (painel, lista, `[id]`, nova, vereadores,
  secretarias, configuracoes/*, exportar), `src/components/emendas/*`,
  `src/lib/emendas/` (`regras.ts` puro e testado, `dados.ts` leituras,
  `actions.ts` execução/cadastro, `actions-config.ts` catálogos/permissões/
  importação, `importacao/` leitor da planilha). Painel: tudo calculado no
  cliente sobre as emendas que a RLS liberou, filtros na URL, filtro
  cruzado por clique nas barras. Relatório do vereador = CSS de impressão
  (salvar como PDF); Excel = `exceljs` em `/emendas/exportar`.
- **Importação da planilha** (Configurações → Importar): prévia (nada
  gravado) → revisão (casos ambíguos de STATUS) → `emendas.importar`, uma
  transação só (reimportar não duplica: ignora o mesmo ano+número). Aba
  "Após" = situação atual; diferença para a aba original vira
  `remanejamentos`. Decisão do dono: "EXECUTADA" = paga; "DP" = data do
  pagamento; "EXECUÇÃO" = empenhada. O leitor de STATUS foi testado com as
  63 grafias reais de 2026 (EMP8677, "Nº EMPENHO 2328", "EMP:V 32856"…).
  Conferência da planilha de 2026: 215 emendas, R$ 5.157.490,05, Saúde
  R$ 2.583.661,43 (50,1%), 15 × R$ 343.832,67, 62 pagas, 1 em execução, 8
  remanejadas. Achados nos próprios dados: nº 90 e 167 "executadas" sem
  empenho; 6 pagas sem data de pagamento; EMP 6366 e 7207 repetidos em
  duas emendas cada.
- **Lições deste módulo**: (1) `apply_migration`/`execute_sql` estouram o
  tempo limite (60s) com migrations grandes — enviar em partes (tabelas,
  funções de permissão, triggers, RLS+view, RPCs uma a uma); (2) um `delete`
  dentro de função plpgsql chamada em lote travou a RPC — `definir_acesso`
  zera com `update` e regrava com `upsert`; (3) `next dev` reescreve um bloco
  "nextjs-agent-rules" no CLAUDE.md: não commitar.
- **Testado**: transações forçadas com `set local role authenticated` e
  `request.jwt.claims` de cada perfil (gestor edita tudo; admin de secretaria
  só a própria e não remaneja; consulta só lê; sem acesso não vê nada; cota,
  modalidade, empenho/pago e cascata do Hub) — 22 cenários, rollback.
  `tsc`/`eslint`/`vitest` (30 testes)/`next build` limpos; telas conferidas
  em 1280px e 390px com os dados reais. **Não testado ponta a ponta no
  deploy** (sandbox sem acesso a `*.vercel.app`/`*.supabase.co`).

- **Link de primeiro acesso persistente (21/10/2026).** Caso real: a conta
  nova de uma usuária só do Emendas respondia "E-mail ou senha incorretos" —
  toda conta criada pelo provisionamento nasce com senha aleatória e o único
  caminho era o link de uso único do Supabase (recovery, ~1 h), mostrado uma
  vez na tela do admin. Agora `hub.convites_acesso` (migration
  `20261021050000`; RLS: só admin do Hub lê, só service_role grava) guarda um
  token da Central por pessoa. `/primeiro-acesso?t=<token>` (rota pública)
  valida o token, gera na hora um recovery do Supabase e segue para
  `/auth/confirm` → `/redefinir-senha`: cliques extras só gastam o token do
  Supabase daquele clique, o convite continua valendo. **Uma senha só**:
  `redefinirSenha`, quando há convite pendente, também grava a senha na conta
  do Numera (`sincronizarSenhaNumera`) — nunca para quem só pediu "esqueci
  minha senha" sem convite. O convite vira `usado_em` ao definir a senha ou ao
  fazer login (`entrar`). Em Configurações → Usuários e acessos o link aparece
  sob o nome de quem nunca entrou (`last_sign_in_at` nulo) e some sozinho;
  quem ainda não tem convite ganha o botão "Gerar link"
  (`obterLinkPrimeiroAcesso`, recusa contas que já acessaram). Contas novas
  (`definirAcesso`, `aprovarSolicitacao`) usam esse link em vez dos de uso
  único (`linkPrimeiroAcessoDaConta`). De carona: o destino padrão de
  `entrar()` era `/dashboard` (não existe no Hub) → `/`. Lição: `execute_sql`
  do MCP estoura 60 s em DDL de função/`drop` neste projeto às vezes; `create
  table`/`alter`/`policy` em comandos separados passam, e `create or replace
  function` em `hub.definir_acesso` precisou ser rodado no SQL Editor do painel.

- **Link por e-mail e pedido de acesso com um clique (21/10/2026).**
  (1) O link de primeiro acesso é enviado por e-mail (Brevo,
  `enviarEmailPrimeiroAcesso`, remetente "Central Cataguases") quando a conta
  é criada (`enviarLinkNoEmailEAnotar`, em `definirAcesso` e
  `aprovarSolicitacao`: o resultado — enviado ou falhou — vai na mensagem do
  módulo, ao lado do link copiável, que continua valendo se o e-mail falhar) e
  pode ser reenviado em Configurações → Usuários e acessos
  (`enviarLinkPrimeiroAcessoPorEmail`, só para quem nunca entrou). Depende de
  `BREVO_API_KEY`/`BREVO_REMETENTE_EMAIL` na Vercel (já usadas pela
  recuperação de senha). (2) Na tela inicial o card de módulo sem acesso é um
  botão "Solicitar acesso" (`solicitarAcessoAoModulo`): nome/e-mail vêm da
  sessão, nunca do navegador; não duplica pedido pendente; depois do clique o
  card mostra "Solicitação enviada — aguardando aprovação"
  (`pedidoPendente`, lido com a service_role só para o e-mail da própria
  sessão). Armadilha evitada: função exportada de arquivo `"use server"` é
  chamável pelo navegador — a leitura de pendências mora em `lib/dados/` (só
  servidor), nunca na action.
- **Remetente dos e-mails padronizado (21/10/2026).** Primeiro acesso e
  recuperação de senha do Hub saem como "Central Cataguases"
  (`REMETENTE_CENTRAL`, em `lib/email/brevo.ts`, definido no código — não
  depende de `BREVO_REMETENTE_NOME` na Vercel); a recuperação do Numera
  continua "Numera" (texto do próprio app). Aviso de pedidos de acesso ao
  admin: só o banner da tela inicial (decisão do dono; sem e-mail por ora).

- **Fases do fluxo editáveis (22/10/2026).** Configurações do módulo →
  "Fases do fluxo" (`/emendas/configuracoes/fases`, só admin do Hub e gestor).
  Banco (migration `20261022000000`): `emendas.etapas` (chave, nome, cor,
  grupo 0-3, fixa — global aos dois fluxos) e `emendas.fluxo_etapas`
  (modalidade, chave, ordem, ativa — um fluxo por modalidade). Os CHECKs de
  lista fixa (`emendas.etapa`, `andamentos.etapa`, `etapa_compativel_
  modalidade`) viraram FK para `etapas` + gatilhos: `validar_etapa_andamento`
  (andamento só em fase ATIVA do fluxo da modalidade da emenda) e
  `zz_ajustar_etapa_modalidade` (mudou a natureza → a fase atual não existe no
  fluxo novo → volta para `etapa_de_retorno`, a primeira fase ativa depois de
  Indicada). `salvar_fluxo(modalidade, itens)` é a única forma de escrever
  (security definer, `eh_gestor`): fixas (indicada, empenhada, liquidada, paga,
  concluida) não saem nem se desativam e seguem essa ordem, Indicada primeiro e
  Concluída por último; nomes únicos entre as ativas; "remover" só fase nunca
  usada no fluxo, senão desativar (histórico fica). O `grupo` (0 sem andamento,
  1 em andamento, 2 empenhada/liquidada, 3 paga ou adiante) é derivado da
  posição em relação a Empenhada/Paga ao salvar — é ele que alimenta barras e
  indicadores. `remanejar` deixou de citar fases no código (volta para
  `etapa_de_retorno`). **Permissões**: `emendas.definir_acesso` agora só aceita
  admin/gestor (o admin de secretaria deixou de ajustar a equipe; decisão do
  dono: todo acesso passa por ele ou pelo gestor).
  App: `CatalogoEtapas` (`regras.ts`: `infoEtapa`/`trilha`/`proximasEtapas`/
  `posicaoNaTrilha`/`etapasEmOrdem`/`porEtapa`/`validarFluxo`, com
  `CATALOGO_PADRAO` de reserva) carregado por `obterCatalogoEtapas()` e levado
  aos componentes de cliente por `ProvedorCatalogo` (layout de `/emendas`) /
  `useCatalogo()`; páginas de servidor chamam `obterCatalogoEtapas()` e
  passam `catalogo` para `BarraEtapas`/`SeloEtapa`/`LinhaEtapas`. Fase
  desativada com emenda nela continua aparecendo (funil/filtro) e a barra usa a
  última fase ativa antes dela. **Lição**: o MCP do Supabase trava (60 s) em
  `drop function`, em `create or replace` de função existente e em funções
  grandes (cause não isolada; não é lock nem tamanho puro) — `salvar_fluxo`,
  `remanejar` e `definir_acesso` precisam ser rodadas no SQL Editor do painel;
  o arquivo da migration é reexecutável. Tabelas, FKs e gatilhos passaram por
  MCP. O banco de produção já tem as 215 emendas importadas: testar sempre em
  transação com rollback.

## Avisos (notificações) ao vivo em toda a plataforma (23/10/2026)

Pedido do dono: a ciência dada pela secretaria no Requerimentos "não chegava"
ao Gabinete/Admin. Diagnóstico: a ciência era gravada (`ciencia_em` +
evento `secretaria_deu_ciencia`, e o Gabinete conseguia lê-la), mas não havia
aviso nenhum — só um texto pequeno dentro do requerimento. Construído um
sistema de avisos da plataforma, entregue ao vivo pelo Supabase Realtime.

- **Banco** (migration `20261023000000_hub_notificacoes.sql`, aplicada por
  MCP em partes): `hub.notificacoes` (destinatário, app, tipo, título,
  mensagem, link = caminho dentro do app, `chave_unica` para não repetir,
  `lida_em`), RLS "só os meus", na publicação `supabase_realtime`. Escrita só
  por `hub.notificar(...)` (security definer, sem EXECUTE para
  authenticated/anon; quem age nunca recebe aviso da própria ação). Leitura:
  `hub.resumo_notificacoes()` (não lidas por módulo) e
  `hub.marcar_notificacoes_lidas(ids?, app?)`.
- **Produtores** (gatilhos que engolem erro com WARNING — avisar nunca desfaz a
  ação de origem):
  - Requerimentos (`requerimentos.notificar_evento` em `eventos_timeline`):
    ciência/resposta/prorrogação → Gabinete e Admin
    (`destinatarios_gabinete`: perfis gabinete/admin + permissão
    `atua_como_gabinete`; diretor fica de fora, decisão do dono);
    distribuição → pessoas da secretaria de destino; devolução e documento
    novo → secretarias vinculadas. Prazo: `requerimentos.avisar_prazos()`
    via pg_cron `requerimentos-avisar-prazos` (8h de Brasília), a 3 dias e
    no dia do vencimento, só secretarias sem resposta + Gabinete.
  - Emendas (`emendas.notificar_execucao` em andamentos, impedimentos e
    movimentos): → gestores do módulo e admins do Hub; a importação da
    planilha não avisa (`current_query()` com "importar"); empenho/pagamento
    gravado junto com o andamento não gera aviso duplicado.
  - Central (`hub.notificar_solicitacao_acesso`): pedido de acesso → admins.
  - **Compras** já tinha `public.notificacoes` (com ~1.800 não lidas
    acumuladas): continua lá; a Central só CONTA os não lidos criados a
    partir de `hub.config_notificacoes.corte_compras` (decisão do dono).
  - **Numera**: segunda etapa (projeto separado).
- **Central**: `SinoNotificacoes` no `CabecalhoHub` (toda tela, inclusive
  Emendas) e `SeloModulo` nos cards da Início — os dois leem o mesmo store
  do navegador (`src/lib/notificacoes/store.ts`, uma assinatura Realtime por
  aba em `hub.notificacoes` e `public.notificacoes`). Clique leva ao ponto
  certo: Central/Emendas direto; apps externos por
  `/sso/silencioso?app=X&proximo=<link>` (`destinoDoAviso`).
- **Requerimentos** (repo `app-requerimentos-camara`): `SinoRequerimentos` no
  cabeçalho (avisos do app, ao vivo; ao chegar um aviso faz
  `router.refresh()` — a lista atualiza sozinha), `/dashboard?req=<id>` abre
  e rola até o requerimento, e os selos de secretaria na lista têm três
  estados (○ aguardando ciência, ◉ ciente, ✓ respondida).
- **Testado** em transação desfeita pelo caminho real (`dar_ciencia` como a
  secretaria → Gabinete e Admin recebem, quem deu ciência não, diretor não),
  distribuição, prazo (sem repetir no mesmo dia), Emendas, pedido de acesso
  anônimo e privilégios; `get_advisors` sem exposição nova. **Não testado ao
  vivo no navegador** (sandbox sem acesso a Supabase/Vercel): o primeiro uso
  confirma a entrega em tempo real.

## Emendas: planilha de cumprimento 2026 + parceria/execução (24/10/2026)

Pedido do dono: atualizar as emendas já importadas com a "planilha de
cumprimento" (mais atual) e avaliar quais colunas viram fase. Registro
completo, números e divergências pendentes em `docs/plano-cumprimento-emendas.md`.

- **Regra**: só a aba das emendas impositivas (87); célula preenchida
  prevalece, vazia não apaga; fase só avança. Subvenções e emendas de
  deputados (outras abas) ficaram fora.
- **Banco** (`20261024000000_emendas_execucao_parceria.sql`): fases
  `termo_parceria` (repasse, ordem 35) e `envio_pagamento` (os dois, ordem 55);
  tabela `emendas.execucao` 1:1 com a emenda — a chave chama `id` (= id da
  emenda) de propósito, para a auditoria genérica (`registrar_auditoria` lê
  `id`) gravar no mesmo `registro_id` da emenda. RLS: lê quem vê a emenda,
  escreve quem edita a execução (`pode_editar_emenda`), apaga só gestor.
- **App**: `PainelParceria` (`components/emendas/painel-parceria.tsx`) no
  detalhe, com alertas de vigência (`situacaoVigencia`, em `regras.ts`,
  testada) e de extrato sem publicação; `salvarExecucao` (actions); rótulos das
  fases novas na linha de etapas vêm do termo/envio; histórico inclui a
  tabela `execucao`; exportação Excel com 9 colunas novas.
- **Carga**: feita por tabela de apoio `emendas._carga_cumprimento` +
  comandos pequenos via MCP (com "importar" no texto, para os gatilhos de aviso
  ficarem quietos). **Lição nova**: no MCP do Supabase, `DELETE`/`DROP` (e um
  `DO` grande) estouram os 60 s — parecem aguardar confirmação de comando
  destrutivo; `INSERT`/`UPDATE` passam. O que sobrou para o SQL Editor:
  apagar o remanejamento da nº 102 e a tabela de apoio.

## Auditoria de desempenho e segurança (24/10/2026)

Pedido do dono: varredura de erros, lentidão, código morto e segurança. Dois
relatórios (banco e código); abaixo, o que foi aplicado e o que ficou.

- **Aplicado — velocidade**: filtros do painel/lista de Emendas trocam a URL
  com `history.replaceState` (`src/lib/emendas/url-filtros.ts`) em vez de
  `router.replace` (que refazia 5-6 consultas no servidor a cada clique; só o
  `ano` ainda vai ao servidor); `obterContextoEmendas` roda acesso, perfil e
  permissões em `Promise.all`; layout de Emendas busca o catálogo de fases em
  paralelo; detalhe da emenda numa rodada só; `listarEmendas` não traz mais
  `descricao` (só com `comDescricao=true`, usado na exportação);
  `listarMovimentos`/`listarExecucoes` em lotes paralelos (o `cache()` antigo
  nunca acertava: array novo a cada chamada); cálculos do painel em
  `useMemo`; `revalidar()` só da emenda mexida e os componentes não chamam
  mais `router.refresh()` (a resposta da action já traz a página nova);
  contagens do cabeçalho em `cache()`; `loading.tsx` (Emendas, Configurações)
  e `error.tsx` raiz.
- **Aplicado — segurança**: Next 16.4.2 (o 16.3.5 tinha falhas críticas/altas
  no `npm audit`; sobraram 2 moderadas no `uuid` dentro do `exceljs`, sem uso
  explorável); cabeçalhos em `next.config.mjs` (CSP enxuta com
  `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` — `script-src` fica de fora de propósito, o Next injeta
  scripts inline sem nonce); `exigirAdminHub()` (`lib/auth/exigir-admin.ts`) no
  topo de toda leitura em `lib/dados/*` que usa a chave de serviço e em
  `alternarBloqueioLoginDireto`; `escaparLike()` nos `ilike` com texto digitado;
  `ROTAS_PUBLICAS` compara rota exata ou subcaminho (não mais `startsWith`
  cru); store de avisos zera estado e fecha o canal Realtime quando outra
  pessoa entra no mesmo navegador; `origemDaRequisicao` saiu do arquivo
  `"use server"` (virava endpoint) para `lib/origem.ts`.
- **Aplicado — limpeza**: removidos `ui/alert.tsx`, `hooks/usar-breakpoint.ts`,
  `preferencia-local.ts`, `linkPrimeiroAcessoHub`; comentários desatualizados
  (SSO, filtro "não volta ao servidor") corrigidos.
- **Aplicado — banco** (`20261025000000_auditoria_indices_e_revogacoes.sql`):
  índices em `emendas.emendas(vereador_id)`, `(beneficiario_id)` e
  `permissoes(secretaria_id)`; `anon` sem EXECUTE nas 12 funções do Compras
  (chat, parecer, suspender/retomar, devolver) — todas já checavam `auth.uid()`.
- **Resolvido depois**: links de e-mail de uso único (`/auth/confirm?token_hash=`
  do Hub e `/api/numera/abrir-link`) não consomem mais o token no GET — o GET
  mostra a página de `lib/seguranca/pagina-confirmar.ts` com o botão
  "Continuar" e só o POST faz o `verifyOtp` (antivírus e prévia de e-mail
  abrem o link por GET e gastavam o token → "link inválido"). O fluxo `code`
  (PKCE) segue no GET. As funções de permissão já eram `STABLE` (a hipótese da
  auditoria estava errada; as 199 mil varreduras em `hub.usuarios` são o
  planner preferindo ler 54 linhas a usar índice). As políticas `FOR ALL`
  das 5 tabelas de catálogo do Emendas viraram INSERT/UPDATE/DELETE de gestor
  + SELECT (SQL rodado pelo dono no SQL Editor; nas tabelas de `hub` e
  `requerimentos` NÃO mexer: tabelas minúsculas, ganho nulo e risco de
  trancar o login). Branches mescladas: o git proxy do ambiente recusa
  `push --delete`, apagar pelo GitHub.
- **Ainda em aberto** (depende do dono ou de infra): (1) **Firewall da Vercel**
  não tem nenhuma regra (a API do MCP responde 404 "config not found" e não
  cria): configurar limite por IP no painel — `/api/numera/resolver-login` 30/min,
  `/api/numera/recuperar-senha` 5/5min (POST), `/recuperar-senha` 5/5min (POST),
  `/solicitar-acesso` 10/5min (POST), `/login` 30/min (POST); o limitador em
  memória do código não vale em serverless. (2) `/api/numera/resolver-login`
  devolve o e-mail de qualquer username: o conserto de verdade é o login do
  Numera mandar usuário+senha para o servidor (muda `auth-service.js` do repo
  do Numera) — só o Firewall mitiga por ora. (3) Ligar "Leaked password
  protection" no Supabase (Auth → senhas): só pelo painel. (4)
  `listUsers({perPage: 1000})` em `lib/dados/usuarios.ts` e a orquestração
  duplicada de `aprovarSolicitacao`/`definirAcesso`.
- **Não testado ao vivo**: sandbox sem acesso a Supabase/Vercel. `tsc`,
  `eslint`, `vitest` (48) e `next build` limpos; conferir no deploy o filtro do
  painel (a URL deve mudar sem recarregar) e uma gravação na emenda (a tela
  deve atualizar sozinha).


## Emendas: tipos de execução, fases por tipo, checklist e pendências (27/10/2026) — Etapa 1

Pedido do dono: trazer para dentro do módulo o checklist do HTML autocontido "Emendas Impositivas
2026" (que servia só para depois redigitar tudo). Plano completo em 3 etapas — esta é a **Etapa 1
(gestão)**; Etapa 2 = importação com aprovação (JSON v1 do HTML, planilhas) + vínculo com Compras;
Etapa 3 = portal público sem login + relatórios (norma aplicável a recurso municipal: **IN TCE-MG
05/2025**, não o TCU, que só vale para verba federal; LGPD: sem CPF, conta mascarada).

- **Banco** (`20261027000000_emendas_tipo_fases_checklist.sql`, aplicada por MCP; só acrescenta):
  `emendas.tipo_execucao` (`direta`/`osc`/`ente`; `v_emendas` ganhou a coluna no fim),
  `exercicios.data_aprovacao_loa/numero_lei_loa/prazo_exequibilidade`, `fluxo_fases` (catálogo de fases por
  tipo, com `etapa` = a fase do cache `emendas.etapa` e `derivacao` = de onde o dado vem),
  `emenda_fases` (só fases MANUAIS), `checklist_itens` (13 direta · 24 OSC · 19 ente, com base legal;
  `condicao` saude/consorcio) + `emenda_checklist`, `pareceres_exequibilidade` (um por secretaria/ano),
  `pendencias_justificadas`. RLS = a de `execucao` (`pode_ver/editar_emenda`); catálogos só gestor.
  Backups `_bkp_20261027_*` (emendas, andamentos, execucao) e `_carga_tipo` ficam no schema `emendas`
  (apagar no SQL Editor quando o dono confirmar). Carga: os 215 receberam o tipo do HTML (85/109/21,
  totais batem); as 7 `processo_compra` das diretas viraram `emenda_fases.demanda` (origem `importacao`).
- **Cada dado tem uma fonte só** (`lib/emendas/fases.ts`, pura e testada): fase com `derivacao` nunca é
  digitada — LOA ← exercício; análise ← parecer da secretaria (ou impedimento aberto = em andamento);
  empenho/liquidação/pagamento ← `movimentos_financeiros`; termo/extrato ← `execucao`. Sem dado próprio,
  fase anterior à etapa atual da emenda aparece "presumida" (por isso as 64 de repasse em "paga" sem
  movimentos NÃO regridem). `emendas.etapa` continua cache do último andamento: concluir uma fase manual
  que adianta a emenda chama `registrar_andamento` (mantém avisos/histórico); se a etapa não vale para o
  fluxo da emenda, só não avança o cache.
- **Pendências** (`lib/emendas/pendencias.ts`, pura e testada; o banco só guarda a justificativa e a
  *assinatura* — mudou o dado, a justificativa deixa de valer): impedimento aberto, empenho > valor, pago >
  empenhado, tipo incoerente com a natureza (ex.: nº 102 é "direta" com natureza 50), termo sem extrato
  (Lei 13.019, art. 38), parceria sem conta específica (art. 51; IN 05/2025 art. 6), vigência (e prestação
  de contas em 90 dias, art. 69), emenda sem andamento (gravidade pelos dias que faltam), prazo de
  exequibilidade vencido sem parecer, datas de fase fora de ordem. `resumo.ts` junta tudo por emenda;
  `calculos.ts` carrega os dados sob a RLS de quem pede.
- **Telas**: faixa de 4px na cor do tipo em cada linha da lista (`TIPOS_EXECUCAO`: direta #1D6A8A,
  osc #9A5A0E, ente #962A52), abas Consolidado/Direta/OSC/Ente e filtro "só com pendência" (URL via
  `replaceState`); Painel com régua do exercício + 1 cartão por tipo (`faixa-tipos.tsx`); detalhe com abas
  Fases · Documentação · Pendências · Financeiro · Andamentos · Anexos · Histórico (`abas-gestao.tsx`);
  `/emendas/pendencias`; Configurações › Exercício (LOA/lei/prazo) e › Exequibilidade (parecer por
  secretaria). Formulário da emenda pede o tipo; exportação Excel traz "Tipo de execução" e filtra por `t`.
- **Ainda não feito (decidido, nas próximas etapas)**: edição de dado já preenchido por perfil de
  secretaria virar *proposta* a aprovar (Etapa 2 — hoje a secretaria grava direto, tudo auditado);
  editor de fases/checklist por tipo na tela (catálogo editável só por SQL por enquanto);
  impedimento em lote a partir do parecer; `NOT NULL` em `tipo_execucao` (a RPC `importar` ainda não
  informa o tipo — o app deduz pela modalidade enquanto for nulo).

## Emendas — Etapa 2: aprovações, importação JSON v1 e vínculo com o Compras (27/10/2026)

- **Banco** (`20261028000000_emendas_propostas_importacoes_compras.sql`, tabelas aplicadas por MCP): `propostas`
  (alvo `execucao`/`emenda_fases`/`emenda_checklist`; `valor_atual` e `valor_proposto` em jsonb; status
  pendente/aprovada/rejeitada/conflito; RLS: gestor vê/decide tudo, autor vê as próprias), `importacoes`
  (`sha256` único: o mesmo arquivo não entra duas vezes), `execucao.processo_id/numero_contrato`.
- **Regra** (em `actions.ts`, não no banco): gestor/admin gravam direto; secretaria grava campo VAZIO na hora e,
  se muda um valor já preenchido, vira proposta (`proporAlteracoes`) — vale para `salvarExecucao`, `salvarFase`,
  `salvarItemChecklist` e `vincularProcesso`; o `Resultado` ganhou `aviso`. **Lacuna conhecida**: não há gatilho
  no banco; uma chamada direta à API ainda grava (tudo fica na auditoria). O gatilho BEFORE UPDATE está descrito
  na migration e precisa ser rodado no SQL Editor se o dono quiser a garantia.
- **Aprovação** (`actions-propostas.ts`, `decidirPropostas`, só gestor): antes de aplicar relê o valor atual; se
  mudou desde a proposta, marca `conflito` e não grava. Tela `/emendas/aprovacoes` (item no menu com selo de
  pendentes; para a secretaria vira "Minhas propostas").
- **Importação JSON** (`importacao/json-v1.ts`, pura e testada; `importarJsonV1`): lê `centraltech.emendas.execucao/v1`
  e só gera propostas — instrumento → `execucao`, `andamentos[]` → fases MANUAIS (as derivadas são ignoradas),
  `checklist[]` → `emenda_checklist`. Vazio no arquivo nunca apaga; fase concluída não regride; `pendente` do
  checklist não derruba o conferido. Movimentos financeiros do arquivo não são importados (já estão no sistema).
- **Compras** (`compras.ts`, `numero-processo.ts`, `vinculo-compras.tsx`): `2026/0062` = `processos.numero`,
  `136/2026` = `numero_licitacao`. Leitura de UM processo com a chave de serviço (a RLS do Compras barra quem não
  tem `public.usuarios`), só depois de a tela confirmar que a pessoa vê a emenda; mostra status, modalidade, setor,
  datas e contrato. Link: `/sso/silencioso?app=compras&proximo=/processos?processo=<id>` (a lista do Compras abre o
  processo pelo filtro `processo=` — confirmado no repo App-Compras). O status do Compras só é exibido: não muda fase.

## Emendas — Etapa 3: portal público e relatórios (28/10/2026)

- **Portal sem login** em `/transparencia/emendas` (prefixo em `ROTAS_PUBLICAS`, `middleware.ts`) + dados abertos em
  `/transparencia/emendas/dados?ano=&formato=csv|json`. Leitura só no servidor (`lib/emendas/portal.ts`, `server-only`),
  com a chave de serviço e LISTA FECHADA de colunas (nunca `select *`): sem descrição completa, observações, gestores,
  CPF nem dirigentes; CNPJ só de beneficiário (PJ); conta da parceria mascarada (`mascararConta`, 4 últimos dígitos);
  emendas canceladas fora. Cache `unstable_cache` de 5 min com a tag `portal-emendas` (`portal-tag.ts`); as actions
  (`actions.ts`, `actions-config.ts`, `actions-propostas.ts`) chamam `revalidateTag(TAG_PORTAL, "max")`. Tela: `components/transparencia/portal-emendas.tsx`
  (filtra no navegador). Base citada no rodapé: LAI (Lei 12.527), LRF art. 48-A, IN TCE-MG 05/2025.
  **Nada novo no banco**: sem view nova nem grant a `anon` — o portal não depende de RLS aberta.
- **Relatórios internos** `/emendas/relatorios` (+ `/csv?r=`): por vereador, por secretaria, por beneficiário,
  parcerias/prestação de contas e impedimentos abertos (`relatorios.ts` puro e testado; `relatorios-dados.ts` sob a RLS
  de quem pede). Impressão pelo CSS de impressão existente; CSV com BOM, `;` e vírgula decimal. São dados de APOIO: o envio
  oficial ao TCE-MG segue o sistema deles (layout de importação do TCE não foi mapeado).

## Emendas — Portal da Transparência refeito, publicação com verificação e boletim (11/11/2026)

- **Publicação por exercício** (migration `20261111000000`): `exercicios.portal_publicado_em/_por/_ciencia`. `anosDoPortal()` só devolve
  publicados (a rota de documento e os dados abertos também). Prévia para quem tem o módulo: `/transparencia/emendas?previa=1`.
  **Depois do deploy o portal mostra "em preparação" até um gestor publicar** em `/emendas/portal`.
- **Verificação** (`lib/emendas/portal-verificacao.ts`, pura e testada) roda sobre as MESMAS linhas que vão ao ar: crítico (CPF em texto
  público, empenho > valor, pago > empenho, pagamento futuro, CNPJ com dígito errado, conta repetida — art. 6º —, cota excedida, relatório
  de gestão vencido, emenda executada sem os itens do art. 7º — § 2º), atenção (cada item do art. 7º que falta) e informativo. Publicar com
  crítico exige ciência marcada, registrada em `portal_ciencia` (`actions-portal.ts` refaz a verificação com `updateTag`). Selo do menu
  "Portal público" = nº de críticos. **Regra nova de verificação = um `add(...)`/`item(...)` em `verificarPortal`.**
- **Portal** (`components/transparencia/*`, `app/transparencia/portal.css` com variáveis próprias `--p-*`/`--s-*`/`--t-*`/`--e-*`, claro e
  escuro escolhidos; o herói é sempre escuro): cálculos em `portal-agregados.ts` (puros); gráficos em SVG/HTML próprios, sem biblioteca;
  cada gráfico-filtro é calculado sem o próprio filtro (mostra todas as opções). Filtros na URL (`replaceState`), `?emenda=N` abre o detalhe.
  **Ao vivo**: `pacoteDoPortal` (cache com tag) devolve `versao` (hash); o navegador consulta `/transparencia/emendas/versao` a cada 30 s e
  faz `router.refresh()` quando muda. Tour `portal-emendas` (tours.ts, `classePopover`), na 1ª visita.
- **Boletim por e-mail**: `emendas.portal_assinantes` (só service_role; GRANT explícito necessário — tabela nova do schema `emendas` não
  herda privilégio de service_role, achado nesta entrega) e `portal_boletim_estado` (fotografia do último envio). Confirmação dupla
  (`actions-boletim.ts`, resposta sempre genérica, 5 pedidos/10 min por IP), página `/transparencia/emendas/boletim` (botão, nunca GET).
  Envio: Vercel Cron diário 11h20 UTC → `/api/transparencia/boletim` com `CRON_SECRET`; primeira execução só fotografa. Teto de 280
  e-mails por execução (Brevo gratuita = 300/dia). **Passos manuais**: `CRON_SECRET` na Vercel (sem ele a rota responde 503 e nada é
  enviado); opcional `PORTAL_URL_BASE` (domínio oficial nos links do e-mail).
- **Exigibilidade por momento (art. 7º, § 2º)**: os itens do art. 7º só são devidos ANTES da execução. `item(..., { antes: true })` em
  `verificarPortal` separa: emenda já executada (empenho ou pagamento) = atenção; ainda sem execução = informativo `id:antes` ("a cumprir antes
  de empenhar"). No detalhe público, `Campo antes` troca "Não informado" por "Será divulgado antes da execução" nas emendas sem execução
  (cronograma, gestor, termo, processo, contrato, extrato, conta, anuência do SUS, plano e metas). Localidade, partido, CNPJ do recebedor e
  dados do exercício continuam "Não informado".
- **Só o administrador da Central publica** (`ctx.usuario.admin_hub`, não o gestor do módulo): botão, `publicarPortal`/`retirarPortal` e, no
  banco, o gatilho `emendas.so_admin_publica_portal` (migration `20261111010000`; testado em transação: gestor barrado, admin passa, gestor
  continua editando os outros campos do exercício). Gestor vê alertas e prévia, mas não publica.
- **Embutir no site da Prefeitura**: só por link (a CSP tem `frame-ancestors 'none'`). Para iframe, liberar o domínio da Prefeitura em
  `next.config.mjs` só para `/transparencia/*`.
- Verificado: `tsc`/`eslint`/`vitest`/`next build`; telas em Chromium 1440 e 390 px, claro e escuro, tour e guia, com dados simulados numa
  rota temporária (removida). **Não testado contra o banco pelo app nem o envio real de e-mail** (sandbox sem `*.supabase.co`/Brevo).

## Limite de tentativas por IP no código (28/10/2026)

O Firewall da Vercel não pôde ser configurado (a API do MCP responde "config não encontrada" e o editor do painel
não aplicou o Rate Limit), então o limite virou código: `lib/seguranca/limite-requisicoes.ts` (`excedeuLimite(rota, ip, limite, janelaSeg)`,
tabela `hub.limites_requisicao`, só service_role; janela fixa, contagem aproximada, **falha aberta** se o banco cair).
Aplicado em `entrar` (30/min), `solicitarRecuperacao` (5/5 min), `solicitarAcesso` (10/5 min),
`/api/numera/recuperar-senha` (5/5 min, responde a mesma mensagem genérica) e `/api/numera/resolver-login` (30/min, responde `email: null`).
O IP vem de `x-forwarded-for`. Não substitui um WAF para ataque volumétrico; regras do Firewall da Vercel continuam bem-vindas se um dia funcionarem.

- **Exportação de feedback para o Claude (23/10/2026)**: em `/feedback` (gestão), o botão
  "Exportar (.zip)" baixa `feedback-AAAA-MM-DD.zip` com os pedidos que estão nos filtros da tela
  (`GET /api/feedback/exportar?app&tipo&status`, só quem `pode_gerir_feedback`). Conteúdo:
  `feedback.md` (índice + uma seção por pedido: app, tipo, status, autor, tela, mensagem, imagens
  referenciadas) e `anexos/NNN-app-i.ext`. Ordem do mais antigo ao mais novo. Para aplicar os
  pedidos: anexar o .zip numa conversa com o Claude. Lógica pura em `src/lib/feedback/exportar.ts`
  (testada); ZIP sem recompressão via `fflate`.
  **PDF único (23/10/2026)**: `?formato=pdf` (botão "Exportar PDF", o principal) gera
  `feedback-AAAA-MM-DD.pdf` com cada pedido seguido dos próprios screenshots
  (`src/lib/feedback/exportar-pdf.ts`, jsPDF; PNG/JPEG embutidos, webp/gif ficam listados como
  não embutidos). Preferido ao .md com base64, que a IA leria como texto e não como imagem.

- **Aviso de mudança de status do feedback (23/10/2026)**: quem manda feedback é
  avisado quando a gestão muda o status (em análise / resolvido / não possível).
  Gatilho `trg_feedback_notifica_status` em `hub.feedback` → `hub.notificar_feedback_status()`
  (migration `20261023020000` do Hub; função e gatilho aplicados em produção em
  duas etapas por causa do tempo limite do MCP em DDL de `hub.feedback`). Compras grava em
  `public.notificacoes` (sino do Compras e da Central leem dali); Requerimentos/Emendas/Central
  usam `hub.notificar`; **Numera** (outro projeto) consulta "Meus envios" ao abrir e ao voltar
  para a aba e avisa por toast (`avisarMudancasFeedback`, último status visto em localStorage).
  Clicar no aviso nos apps dispara o evento `abrir-feedback-meus`, que o `BotaoFeedback` ouve
  para abrir em "Meus envios". Não avisa quem mudou o status nem repete o mesmo status.


## Emendas — editor de fases/documentos por tipo e impedimento em lote (29/10/2026)

- **Fases e documentos por tipo** (Configurações › "Fases e documentos por tipo", `/emendas/configuracoes/catalogo`,
  `components/emendas/config/editor-catalogo-tipo.tsx`): edita `fluxo_fases` e `checklist_itens` sem SQL. Ações em
  `actions-config.ts` (`salvarFaseCatalogo`, `salvarOrdemFases`, `removerFaseCatalogo`, `salvarItemChecklistCatalogo`,
  `salvarOrdemChecklist`, `removerItemChecklistCatalogo`), todas só gestor. Regras: fase com `derivacao` (LOA, parecer,
  empenho, liquidação, pagamento, termo, extrato) só renomeia/desativa e NUNCA remove nem troca a etapa (a LOA não
  desativa); fase/item já usado em alguma emenda só desativa (remover é bloqueado); nova fase entra antes de
  "Encerramento"; a chave vem do nome (slug). Reordenar regrava a `ordem` (10, 20, 30…). Não confundir com a aba
  "Fases do fluxo", que edita as ETAPAS por modalidade (`emendas.etapas`/`fluxo_etapas`).
- **Impedimento em lote** (Configurações › Exequibilidade, `registrarImpedimentosEmLote`): só gestor, exige o parecer da
  secretaria já registrado; insere impedimento `tecnico` (data = data do parecer, `parecer_ano`/`parecer_secretaria_id`
  preenchidos) nas emendas marcadas e PULA as que já têm impedimento aberto; confere que todas são da secretaria e do
  exercício. O gatilho existente passa a emenda para "impedida" e avisa os gestores (um aviso por emenda).
- Testado: insert do lote em transação desfeita no banco; `tsc`/`eslint`/`next build`. Não testado no navegador.

## Emendas — busca de processos do Compras e dicas nas fases (28/10/2026)

- **Um processo só por compra**: no Compras o processo tem dois números (`numero` AAAA/NNNN, nasce em Compras; `numero_licitacao` NNN/AAAA, dado ao ir para Licitação) — é a MESMA linha. DFD/ETP/TR, pesquisa de preços, contratação e contrato usam o vínculo único da emenda (`execucao.processo_id`); o campo "documento" da fase só guarda o número de referência (processo, licitação ou contrato).
- `sugerirProcessosCompras` (actions.ts) → `sugerirProcessos` (compras.ts, service role, ≤6 linhas, colunas `id,numero,numero_licitacao,objeto,status`): vazio = palavras do objeto da emenda (`palavrasChave`); só dígitos e `/` = trecho de número; resto = palavras do objeto (AND). Exige acesso à emenda (RLS em `v_emendas`) e limite 120/min por IP. `classificarBusca`/`palavrasChave` em `numero-processo.ts` (testadas).
- UI: `CampoProcesso` (combobox com teclado), `DicaAjuda` ("?" com hover/foco/toque), `DICAS_FASE` em `abas-gestao.tsx` + atalhos "Do Compras:" no editor da fase (`AtalhosCompras`, vindo do processo vinculado). Escolher a sugestão só preenche o campo; vincular continua exigindo o clique (e, para quem não é gestor, aprovação).
## Auditoria de segurança pós-Emendas (29/10/2026)

- **Achado (médio) — Compras lido com chave de serviço**: `vincularProcesso` deixava qualquer editor de emenda ligar
  (e então ver os dados de) QUALQUER processo do Compras digitando o número, ultrapassando a RLS de lá. Agora só
  gestor/admin liga direto; os demais geram proposta (`processo_id` + `processo_licitatorio`) e os dados só aparecem depois
  da aprovação. Sobra um "oráculo de existência" (a busca do número informa se o processo existe) — aceito: números são
  sequenciais e nada do conteúdo vaza.
- **Achado (médio) — `propostas` aceita INSERT de qualquer editor** (RLS `insere_propostas`): `decidirPropostas`
  passou a validar cada proposta antes de aplicar (`validarProposta`: campos de `execucao` em lista fechada, `processo_id`
  como uuid, situações/estados nos enums, chaves no formato) — uma proposta forjada não grava campo arbitrário.
- **Achado (baixo)**: `salvarItemChecklist` aceitava qualquer `item_chave`; agora exige item ativo do catálogo do tipo da emenda.
- **Dependências**: `zod` 4.6.5 → 4.6.7 (alta: esgotamento de memória em coleções grandes). Sobram 2 moderadas no `uuid`
  dentro do `exceljs` (sem uso explorável; a correção força downgrade do exceljs).
- **Conferido sem achado**: todas as tabelas de `emendas`/`hub` têm RLS; `anon` só alcança `apps_feedback`,
  `config_modulo` e `solicitacoes_acesso` (as 3 esperadas); tabelas de backup sem acesso de `anon`/`authenticated`;
  políticas do bucket `emendas-documentos` por permissão da emenda; portal público com colunas fechadas e sem
  `dangerouslySetInnerHTML`/`eval` no código; CSV com neutralização de fórmulas.

- **Três números por processo (28/10/2026)**: processo (`processos.numero`, Compras), licitação (`numero_licitacao`, ao ir para Licitação) e contrato (`contratos_vigentes.numero` por `processo_id`, setor de Contratos; `processos.contrato_vinculado` é só reserva). `buscarProcessoPor*` traz `contratos` (≤5); `VinculoCompras` lista os três com "Vale para: fase X"; a busca por número também casa o contrato. Atalho da fase de contrato = 1º contrato.

## Base legal nas telas (29/10/2026)

`src/lib/emendas/base-legal.ts` guarda as citações em um lugar só (`BASES`, `BASE_DA_PENDENCIA`); `BaseLegalLinha`/`BaseLegalDica` (`components/emendas/base-legal.tsx`) as mostram; `Pendencia.base` vem de `baseDaPendencia(regra)`. Fases e checklist mostram `referencia`/`referencia_legal` do catálogo com o prefixo "Base legal:". **Vereadores: a CF art. 166 vale por simetria; percentual e prazos reais estão na Lei Orgânica do Município — as citações foram redigidas de memória e precisam de revisão do jurídico/controle interno antes de serem tratadas como definitivas.** Novas regras de pendência: acrescentar a chave em `BASE_DA_PENDENCIA`.

## Ajustes pós-teste de uso (29/10/2026)

- **Lentidão**: medido no banco como gestor (EXPLAIN ANALYZE com `request.jwt.claims`): `v_emendas` 2026 ≈ 350 ms, movimentos ≈ 110 ms, execução ≈ 70 ms — somado < 1 s, então os 10-30 s relatados NÃO estão no banco. `vercel.json` já fixa `gru1` (mesma região do Supabase, sa-east-1). Para achar a etapa lenta: `lib/emendas/tempo.ts` (`medir`) registra `[tempo] rótulo Nms` nos logs da Vercel quando uma etapa passa de 300 ms (layout, painel, lista, pendências, cálculos); a retenção de logs na Hobby é de 1 h — abrir a tela e ler logo em seguida. Se aparecer etapa >1 s, aí sim vale cache/paginação.
- Pendências: cartão com "Abrir emenda nº", "Mostrar justificadas" (`?j=1`, com data), regra `objeto_generico` (baixa). Objeto da emenda exige ≥ 15 caracteres. Curva de pagamentos explica os pagamentos sem data. Nome do vereador completo em lista e filtros. Esqueleto de carregamento em lista e pendências.

- **Exportação em PDF (29/10/2026)**: `lib/emendas/pdf.ts` (`montarPdfTabelas`, jsPDF, paisagem, só helvetica/Latin-1 — símbolos fora disso são trocados) alimenta `GET /emendas/exportar?formato=pdf` (mesmos filtros do Excel, sob a RLS de quem pede) e `GET /emendas/relatorios/pdf?r=` (um relatório ou todos). Botões na lista e na tela de Relatórios.

## Conformidade com a IN TCE-MG 05/2025 e a Recomendação MPC-MG 01/2025 (29/10/2026)

Análise completa e status em `docs/analise-conformidade-tce-emendas.md`. Decisão do dono: publicar gestor e banco/conta completos; **alertar, não bloquear**, empenho sem publicidade completa.

- **Banco** (`20261029010000_emendas_conformidade_in05.sql`, aplicada por MCP): `execucao` ganhou localidade, inicio/termino_previsto, plano_metas, plano_outras_fontes, plano_despesa_*, anuencia_sus(+data), identificador_contabil, fonte_recurso; `exercicios` ganhou municipio_nome/cnpj e unidade_parlamentar; `documentos` ganhou `competencia` e os tipos `relatorio_gestao` e `anuencia_sus`. `conta_bancaria` segue texto livre ("BANCO … AG … CONTA …") — o banco oficial e a conta repetida são deduzidos do texto (`bancoOficial`, `chaveDaConta`).
- **Regras puras** em `lib/emendas/conformidade.ts` (testadas): `avaliarArt7` (itens I a XVII + art. 5º, com `aplica` por tipo/saúde/execução), `gndDaNatureza`, `contasRepetidas`, `relatoriosDeGestao` (30/06 do ano seguinte ao 1º pagamento). `resumo.ts` devolve `conformidade` por emenda e alimenta as pendências `publicidade_incompleta`, `conta_repetida`, `conta_banco_nao_oficial`, `relatorio_gestao:AAAA`. **Novo item do art. 7º = nova entrada em `avaliarArt7`.**
- **Telas**: `/emendas/conformidade` (resumo por item + lista), bloco `PainelTransparencia` (`salvarTransparencia` → `gravarCamposExecucao`, mesma regra de propostas), `EditorDadosPublicacao` (Configurações › Exercício), anexos novos.
- **Portal** (`portal.ts`): lista fechada ampliada (gestor, conta completa, datas dos movimentos…); `GET /transparencia/emendas/documento/[id]` entrega por link temporário SÓ plano de trabalho, relatório de gestão e anuência do SUS (`TIPOS_DOCUMENTO_PUBLICO`) de emendas não canceladas. Nunca expor CPF, endereço de pessoa física nem outros anexos.

## Módulo Frotas (5º módulo — roda DENTRO do Hub, 04/11/2026) — Etapa 1

Pedido do dono, a partir das necessidades da funcionária do Setor de Frotas (mockup aprovado antes de construir; o fluxo mudou: a
secretaria manda o **orçamento**, o Frotas analisa contra o histórico e libera, a secretaria executa na oficina/posto). Como o Emendas:
rotas `/frotas/*` neste repositório, mesma sessão (sem link mágico), schema próprio `frotas` no projeto compartilhado. Cor `#5C7A1F`
(texto `#3F5A12`); `MODULOS.frotas` tem `interno: true`; o card "Em breve" da Início virou o módulo real.

- **Passo manual do dono (obrigatório)**: Supabase → Settings → API → Exposed schemas → adicionar `frotas` (o schema só aparece na lista
  depois de criado, o que já foi feito). Sem isso toda tela do módulo falha (PGRST106) e o bloco "Frotas" do formulário de acesso devolve erro.
- **Acesso = admin do Hub OU (`frotas.usuarios` + módulo `frotas` em `hub.acessos_modulo`)**. De propósito NÃO há `ativo` próprio nem cascata em
  `hub.definir_acesso` (função grande, o MCP trava ao recriá-la): tirar o módulo na Central corta o acesso na hora (`frotas.meu_perfil()` confere
  `acessos_modulo`) e marcar de novo devolve. Perfis: `gestor` (Setor de Frotas, tudo) e `consulta` (só lê). Para mudar o perfil de quem já tem o
  módulo: desmarcar e marcar de novo em Configurações → Usuários (o formulário de decisão só aparece para módulo recém-marcado).
- **Banco** (`20261104000000_frotas_schema.sql`, aplicada por MCP em partes; a RLS/privilégios foi reaplicada por `execute_sql` sem os `drop`/`revoke`
  que o MCP trata como destrutivos e pede confirmação): `secretarias` (com `controla_combustivel`), `fornecedores` (posto/oficina/locadora),
  `veiculos`, `notas_combustivel`, `manutencoes`, `parametros` (1 linha: limites dos alertas), `auditoria` (gatilho genérico, como no Emendas), `usuarios`.
  Regras no BANCO: ordem das datas da NF (emissão ≤ envio ≤ retorno ≤ Contabilidade) e da manutenção (cadeia OC → envio da OC → NF → retorno dos
  documentos → Contabilidade, NF com número+data+valor juntos, OC só com serviço liberado), NF única por secretaria+posto+número, OC única, alugado
  exige locadora, valor de referência sempre com a fonte. Só gestor escreve (RLS); `anon` sem nenhum privilégio. Testado em transação desfeita com
  perfis simulados (28 cenários: anon, sem acesso, consulta, gestor, admin, módulo removido e devolvido). Integração na Central: CHECKs de
  `acessos_modulo`/`solicitacoes_acesso`/`notificacoes` aceitam `frotas`; linha `frotas` em `hub.apps_feedback` (+ `APPS_FEEDBACK`).
- **Fluxos**: NF de combustível = **por secretaria a cada quinzena** (sem litros nem veículo: isso fica no sistema de abastecimento); a situação é
  deduzida das datas (`situacaoNota`). Manutenção: `situacaoManutencao`/`passosManutencao` (orçamento → análise → liberado → OC do IPM → OC enviada →
  NF → documentos de volta → Contabilidade); a OC é emitida no IPM, aqui só o número. Orçamento recusado/novo orçamento ficam no registro; um novo
  orçamento reabre a análise. O custo conta a NF, senão a OC, senão o orçamento liberado (`custoManutencao`).
- **Código**: `src/lib/frotas/` — `regras.ts` (datas, quinzenas, níveis de alerta, etapas), `revisao.ts` (dados a revisar do cadastro), `analise.ts`
  (painel, custo × valor do veículo, 7 alertas automáticos, análise de um orçamento), `filtros.ts`, `entrada.ts`, `fipe-parse.ts` (+ `fipe.ts`, rede),
  `importacao/{normalizar,planilha,xlsx}.ts`, `dados.ts` (leituras sob a RLS), `actions.ts` e `actions-importacao.ts` (escritas; nenhuma usa
  service_role). Telas em `src/app/frotas/*` (painel, combustivel, manutencao, veiculos[/importar], analise, configuracoes) e `src/components/frotas/*`.
  Tudo puro é testado (`*.test.ts`, 100+ testes). Filtros das listas vão na URL por formulário GET (sem JS).
- **Importação da planilha de veículos** (`/frotas/veiculos/importar`): prévia sem gravar → confirmar. Reconhece as abas pelas colunas (patrimônio =
  próprios, setor = convênio, locadora = alugados), padroniza placa ("QOR - 2576" → QOR-2576), combustível ("DISEL S10"), ano ("2023/24"), marca,
  secretaria+setor ("SAUDE / PSF" → Saúde + PSF; Conselho Tutelar → setor do Gabinete), separa motos da classe "leve" e tira o motivo da parada
  ("aguardando leilão") da finalidade. **Não corrige duplicidades**: placa repetida (QQB-9947 está nos Próprios e no Convênio), patrimônio repetido,
  zerado ou fora do padrão e máquinas sem placa entram como estão e ficam em "Dados a revisar" até serem corrigidos ou marcados "está correto"
  (`revisao_ignorada`). Reimportar não duplica nem sobrescreve (chave = vínculo+placa+patrimônio+modelo+ano). O `cabeçalho` da planilha é "COMBUT."
  (abreviado): o teste pegou o erro de só reconhecer "COMBUST…".
- **FIPE** (`fipe.ts`, API pública da Parallelum v2; `FIPE_API_URL`/`FIPE_API_TOKEN` opcionais): em Veículos → editar → "Procurar na FIPE" (tipo →
  marca → modelo mais parecido → ano/combustível → "Usar este valor"), que guarda os ids e o valor; "Atualizar valores da FIPE" refaz os já ligados
  (25 por clique). Máquinas não têm FIPE: valor digitado na mão (`valor_fonte = manual`). **Não testado contra a API real** (o ambiente de
  desenvolvimento não alcança a internet): só a leitura das respostas e a escolha de modelo/ano têm teste (`fipe-parse.test.ts`). Conferir no
  primeiro uso; se a API exigir token ou mudar o formato, ajustar `fipe.ts`/`lerLista`.
- **Ainda não feito (etapas seguintes)**: secretarias vendo/confirmando as próprias pendências (hoje só o Setor de Frotas e a consulta), importação do histórico de gastos mensais por secretaria (a funcionária tem 1 planilha),
  consumo por veículo (dependeria dos dados do sistema de abastecimento).
- **Verificado**: `tsc`/`eslint`/`vitest` (184)/`next build` limpos. **Não testado no navegador nem contra o banco pelo app** (sandbox sem acesso a
  `*.supabase.co`/`*.vercel.app`): o primeiro uso confirma as telas, a leitura do .xlsx real (ExcelJS) e a FIPE.

### Frotas: exportar, sino e a fonte do valor FIPE (04/11/2026)

- **Exportar** (`/frotas/exportar?r=<relatório>&formato=xlsx|pdf|csv`, mais os filtros da tela): `src/lib/frotas/relatorios.ts` (puro, testado) monta as
  tabelas — veículos (com valor e avisos de revisão), NFs de combustível, manutenções, custo × valor do veículo, gasto por secretaria, **remessa à
  Contabilidade** (NFs assinadas e manutenções com documentos no Frotas, com total e dias parado; é a relação imprimível) e pendências; `r=completo` (só
  Excel) junta tudo, uma aba por relatório. `xlsx-saida.ts` (ExcelJS: cabeçalho fixo, moeda, total), `montarPdfTabelas` do Emendas (ganhou o parâmetro
  `rodape`) e CSV com BOM/`;`/vírgula decimal e fórmulas neutralizadas. Sob a RLS de quem pede: quem só consulta exporta o que enxerga. Botão "Exportar"
  (`MenuExportar`) em todas as telas; as listas levam os filtros da URL junto (`opcoesExportar`). CSV só nos relatórios de uma tabela.
- **Sino** (migration `20261104010000_frotas_avisos_sino.sql`, aplicada por MCP; job `frotas-avisar-pendencias` no pg_cron às 11h05 UTC = 8h05 em
  Brasília): `frotas.avisar_pendencias()` chama `hub.notificar` (app `frotas`; o sino e o selo do card da Central já leem `hub.notificacoes`, nada novo
  no front). Aviso por "ação de outra pessoa" quase não existiria (quem age não é avisado e o Setor de Frotas faz quase tudo), então o sino cobre o que
  ninguém está olhando: NF com a secretaria há N dias, NF assinada esperando a Contabilidade, manutenção parada em cada etapa (liberada sem OC, OC sem
  envio, sem NF, sem documentos, documentos à espera da Contabilidade), orçamento sem análise, quinzena fechada sem NF (uma vez, 5 dias depois de ela
  acabar) e veículo acima de `pct_atencao`/`pct_critico` do valor. N = `dias_atencao`/`dias_critico` de `frotas.parametros` (os mesmos do Painel). Cada aviso
  tem `chave_unica` (não repete; piorar de atenção para crítico gera um novo). **Recebem**: gestores do módulo (perfil `gestor`, ativo, com o módulo
  marcado); consulta e admins do Hub não (veem tudo no Painel). A função só roda pelo agendador (sem EXECUTE para ninguém); falha numa seção vira
  WARNING e não derruba as outras. Testado em transação desfeita: 5 avisos ao gestor, 0 à consulta, 0 na segunda chamada, NF recente sem aviso; a aritmética
  das quinzenas conferida em 9 datas (virada de mês e de ano, fevereiro). Para desligar: `select cron.unschedule('frotas-avisar-pendencias')`.
- **Fonte do valor FIPE (pesquisa de 04/11/2026; as páginas oficiais não puderam ser abertas — o ambiente bloqueia a rede —, então os pontos abaixo vêm
  de resultados de busca e de SDKs de terceiros e precisam de conferência)**: (1) *fipe.online / Parallelum v2* (a que o código usa): sem chave, cerca de 500
  consultas por dia; com token gratuito (`X-Subscription-Token`), cerca de 1.000; planos pagos sem limite e com histórico. Consulta por marca → modelo → ano
  ou direto por **código FIPE + ano** (`/{tipo}/{codigoFipe}/years/{ano}`), e o parâmetro `reference` escolhe o mês da tabela. Fontes divergem no endereço
  (`fipe.parallelum.com.br` × `fipe.api.br`): por isso `FIPE_API_URL`. (2) *BrasilAPI* (`/api/fipe`): sem chave, código aberto (MIT), mas os termos pedem para não fazer
  varredura automática nem laços de requisições; não publica cota. **Recomendação**: ficar na Parallelum com o token gratuito — o uso é pequeno (vincular
  cada veículo uma vez, ~150, e atualizar uma vez por mês, ~150 consultas) e cabe folgado no limite diário; usar a BrasilAPI só como reserva, manualmente. O
  vínculo com a FIPE é por veículo (ids da marca/modelo/ano guardados), então a atualização mensal é uma consulta por veículo. **Ainda não testado contra a API
  real**: no primeiro uso, vincular um veículo e conferir valor, mês de referência e código FIPE.

## Padrão visual dos módulos (04/11/2026)

Pedido do dono: identidade visual única entre os módulos. Auditoria (skills de UX e de design) achou: o botão de Ajuda era um quadrado branco no
cabeçalho marinho (os outros, ícones escuros de tamanhos diferentes); nenhum controle do cabeçalho tinha foco visível; alvos de 36–40 px; sem botão
explícito para voltar à Central dentro dos módulos; navegação, botões, cartão, título e menu Exportar duplicados e divergentes entre Emendas e Frotas;
painel do sino e menu Exportar saíam da tela no celular (conferido em captura: "visos" em vez de "Avisos"). **Direção mantida de propósito**: a
identidade institucional que já existe (marinho `#0C1D33`, dourado, brasão, Geist), só consolidada — não se trocou fonte nem paleta.

- **Cor do módulo por variável CSS**: cada layout de módulo põe `style={estiloModulo(MODULOS.x)}` (`components/modulo/tema.ts`), que define `--modulo`
  (faixa, ponto, sublinhado — nunca texto) e `--modulo-texto` (botões e texto, ≥ 4,5:1 sobre branco; há teste de contraste). Fora de módulo, `globals.css`
  define o padrão (dourado/marinho). **Módulo novo = uma entrada em `MODULOS` + `style={estiloModulo(...)}` no layout**; botões, navegação e Exportar já saem na cor dele.
- **Kit compartilhado** em `src/components/modulo/`: `ui.tsx` (`CLASSE_BOTAO`/`_SECUNDARIO`/`_PERIGO`/`_COMPACTO`, `Cartao`, `Selo*`, `TituloPagina`, `Campo`,
  `Mensagem`, `Vazio`), `nav-modulo.tsx` (faixa de navegação única; `acao` = botão principal à direita), `menu-exportar.tsx` (Esc devolve o foco, setas
  navegam, abre para o lado com tela). `components/frotas/ui.tsx` reexporta e guarda só o que é do Frotas; `components/emendas/menu-exportar.tsx` reexporta.
  Os botões têm 44 px de altura no celular e 36 px no computador, com anel de foco na cor do módulo.
- **Cabeçalho** (`components/layout/cabecalho-hub.tsx`, dividido em `CabecalhoHub` (dados) e `CabecalhoVisual` (puro)): faixa de 3 px na cor do módulo; em módulo,
  brasão + **"← Central"** (voltar) + nome do módulo com o ponto da cor; à direita, nesta ordem: Novidades, Configurações, Feedback (gestão) · **sino, megafone,
  ajuda** · usuário, Sair. Todos os controles usam `cabecalho-estilos.ts` (`CLASSE_ICONE_CABECALHO`, `CLASSE_LINK_CABECALHO`, `CLASSE_CONTADOR_CABECALHO`): 40 px no
  computador e 44 px no celular, foco dourado (`.cabecalho-escuro`), no celular Configurações/Feedback/Sair viram ícones. Sino, ajuda e feedback usam a mesma classe;
  sino e ajuda fecham com Esc devolvendo o foco e têm painel que cabe na tela no celular; o painel do sino é `role="dialog"`.
- **Global** (`globals.css`): foco visível em todo elemento interativo (`:focus-visible`, azul; dourado no cabeçalho escuro), `cursor-pointer` nos botões e link de **"Pular para o
  conteúdo"** (`id="conteudo"` no `<main>` de toda tela com cabeçalho). Título de página padrão: `text-2xl font-semibold tracking-tight` (`TituloPagina`; as telas do Emendas
  que têm o próprio `<h1>` seguem o mesmo).
- **Admin com acesso pleno**: Configurações → Usuários e acessos mostra o administrador com todos os módulos (anel tracejado = implícito) e o formulário avisa; o acesso real
  já era pleno (`hub.eh_admin_hub()` em `meu_perfil` do Emendas e do Frotas, `listarModulosComAcesso` e `temAcessoAoModulo`). Compras, Requerimentos e Numera têm login e cadastro
  à parte: o administrador só entra neles se também tiver conta lá.
- **Apps fora deste repositório** (Compras, Requerimentos, Numera) — **alinhados em 05/11/2026**: cada um tem uma cópia de `cabecalho-estilos.ts`
  (Compras e Requerimentos; o Numera repete as medidas em `styles.css`, `.topbar-*`) e o mesmo desenho: logo/brasão (→ início do app), **"← Central"** (borda
  `white/20`, único atalho para a Central — o da barra lateral do Compras saiu), divisor, ponto na cor do app + nome; à direita: links do app (Requerimentos:
  Início, Configurações) · avisos → feedback → ajuda (→ tema no Compras) · nome → Sair (ícone no celular). Foco dourado por `.cabecalho-escuro`.
  Diferenças que ficaram de propósito: Requerimentos não tem Ajuda (o app não tem tutorial) e o Numera não tem sino (projeto Supabase à parte, avisos
  ainda não chegam lá). Mudou um controle aqui? Repetir nos três repositórios.
- **Verificado em navegador** (Chromium headless, 1280 e 390 px, com os componentes reais numa página de teste temporária, removida): cabeçalho, navegação, botões, selos,
  campos, Exportar e sino nos dois módulos; sem rolagem horizontal; alvos medidos (40×40 / 44×44); foco volta ao botão após Esc. **Não verificado**: leitor de tela, o diálogo de feedback no celular, as telas autenticadas reais.

### Frotas: fluxo simplificado, colunas da exportação e PDFs (05/11/2026)

- **Fluxo da manutenção** (migration `20261105000000_frotas_fluxo_simplificado.sql`, aplicada por MCP): saíram "OC enviada à secretaria" e "documentos de volta ao Frotas". Passos: orçamento → análise → liberado → OC → NF → Contabilidade. `man_cadeia`: NF exige OC, Contabilidade exige NF; as colunas `oc_enviada_em`/`docs_retornaram_em` ficam no banco, zeradas e sem uso (não foram apagadas por serem destrutivas). `frotas.avisar_pendencias()` foi atualizada (etapas `oc`/`nf`/`contabilidade`). Etapas do app: `liberada` → `oc_emitida` (aguarda NF) → `nf_registrada` (a enviar à Contabilidade) → `concluida`.
- **OC, NF e Contabilidade em etapas**: `registrarOc`/`registrarNf`/`registrarContabilidade`/`desfazerEtapa`/`salvarObservacoesManutencao` (actions.ts) substituem `registrarDocumentos`; UI `EtapasDocumentacao` (um cartão por etapa, só a da vez abre; "Corrigir"/"Desfazer").
- **NF acima da OC** (`nfAcimaDaOc`, regras.ts): a causa do aviso que "não aparecia" era ele existir só na resposta do salvamento e sumir no `router.refresh()`. Agora é calculado do que está gravado: faixa na tela da manutenção, selo na lista, alerta crítico `nf_acima_oc` no painel e coluna "Alerta" na exportação; `registrarNf`/`registrarOc` comparam com o valor gravado no banco.
- **Colunas da exportação**: `lib/frotas/colunas.ts` (catálogo por relatório, `sem=A|B` na URL, testado contra as tabelas reais); `MenuExportarFrotas` ("Escolher colunas…") guarda por usuário no banco (`frotas.preferencias_exportacao`, RLS só da própria linha; migration `20261105010000`; lida no layout e levada por `ProvedorColunasExportacao`, gravada por `salvarColunasOcultas`) só o que foi escondido, então coluna nova aparece sozinha. A planilha completa sempre sai inteira.
- **Orçamentos em PDF** (`/frotas/manutencao/importar`): `unpdf` lê o TEXTO no servidor, `orcamento-pdf.ts` propõe placa/valor/data/oficina/serviço, a pessoa confere e `confirmarOrcamentosPdf` grava (revalidando cada linha). O PDF nunca é guardado. **Sem OCR**: PDF digitalizado (imagem) volta "sem texto" para preenchimento manual — OCR (tesseract) é pesado demais para função serverless; avaliar um serviço à parte se for essencial. O leitor foi calibrado com textos de exemplo, não com PDFs reais de oficinas: ajustar `orcamento-pdf.ts` com os primeiros reais.
- **Palavras cortadas**: a faixa de navegação dos módulos e as abas de Configurações rolavam na horizontal no celular (últimas abas escondidas); passaram a quebrar linha. `Selo` não força mais linha única.

## Modo escuro (05/11/2026)

Pedido do dono: o modo escuro existia só no Compras e precisa existir em todos os módulos. Mesmo esquema do Compras, **sem** a camada "estilo Apple" (essa continua só lá, decisão à parte):
- `lib/tema.ts` (modo `auto|claro|escuro`, `localStorage["tema"]`, evento `tema-mudou`) + script no `<head>` (`SCRIPT_TEMA_INICIAL`, sem piscar) + `AlternarTema` no cabeçalho (depois da ajuda) + Minha conta → Aparência.
- A escala `slate` do Tailwind e `text-cataguases-marinho/azul` viraram variáveis (`--slate-*`, `--txt-*`, `--surface`, em `tailwind.config.ts`/`globals.css`); `.dark` inverte os valores, então os ~600 usos de `slate-*` mudam sozinhos. `bg-white` literal vira `--surface` (regra **fora** de `@layer utilities` de propósito: lá o Tailwind a expandiria em `file:`/`hover:` e quebraria o build). Paletas semânticas (`red/amber/green/emerald/violet/blue/sky/indigo/teal` 50–950) têm override em `globals.css`.
- Áreas sempre escuras (cabeçalho) levam `tema-fixo` (restaura a escala clara por dentro); painel dentro delas que segue o tema leva `tema-atual` (sino, ajuda).
- **Cor do módulo**: `--modulo-texto` segue sendo o FUNDO de botão (texto branco); texto/ícone/anel/accent usam `--modulo-tinta` (igual no claro; no escuro vale `--modulo-tinta-escuro`, via `corTextoEscuro` em `MODULOS`, testado ≥4,5:1). Módulo novo = preencher `corTextoEscuro`.
- Cores fixas em `style=""` e em classes hex (`text-[#5B3FA8]` etc.) têm versão clara no escuro em `globals.css`; **cor de texto nova com hex escuro precisa entrar nessas listas**. Regra: superfície nova use `slate-*`/`bg-white`/tokens shadcn, nunca hex claro/escuro fixo.
- Hub tinha `color-scheme: only light` (para o Chrome não escurecer sozinho); trocado por `light dark` + classe `dark`.
- Preferência é **por navegador/domínio**: cada app guarda a sua (não há sincronização entre Hub, Compras, Requerimentos e Numera).
- Verificado em Chromium (1280 e 390 px, claro e escuro) com componentes reais numa página de teste temporária (removida). Telas autenticadas reais não testadas.

## Estilo Apple em todos os módulos (05/11/2026)

Pedido do dono: o visual "Apple" (vidro) do Compras vale para tudo. Hub (+ Emendas e Frotas) e Requerimentos receberam a **mesma camada** do Compras: bloco `html.estilo-apple` em `globals.css`, classe `estilo-apple` no `<html>` (default; `lib/tema.ts` agora também guarda `estilo` = `classico`; script do `<head>` aplica), ganchos de classe nos componentes (`cab-pagina/cab-marca/cab-regua/cab-titulo/cab-sub` em `CabecalhoPagina`, `btn-ui` nos botões, `tema-fixo` no cabeçalho), `--azul` por variável. Em Minha conta → Aparência (Hub) dá para voltar ao Clássico; Requerimentos e Numera não têm essa opção (só Apple). O Numera já era vidro desde o redesign dele.
- Página sem `.fundo-institucional`: o fundo com manchas vai no `<body>` (`html.estilo-apple body`) e a raiz `.min-h-dvh.bg-slate-50` fica transparente — é o que o vidro dos cartões "mostra".
- **A faixa de 3 px do topo do cabeçalho é a cor do módulo (identidade)**: a regra do cabeçalho em vidro claro só mexe em `border-bottom/right-color`, nunca em `border-color` (antes apagava a faixa).
- Cartões em vidro = `bg-white` com `rounded-xl|2xl`; campos, menus e `rounded-lg` ficam sólidos. Cartão novo que deve ser vidro: `rounded-xl`.
- Detalhe do processo em "folha" é do Compras (não existe equivalente nos outros).

## Paridade entre módulos (05/11/2026)

Regra do dono: **o que existe num módulo deve existir nos outros**. Estado:
- **Aparência (estilo Apple ou Clássico + modo claro/escuro/automático)** em todos: Hub e Compras e Requerimentos em Minha conta → Aparência; Numera numa janela aberta pelo nome do usuário (`abrirAparencia()`; Clássico = `html.estilo-classico`, o padrão é o vidro que já era dele). Preferência por navegador/domínio.
- **Minha conta** (aparência + trocar senha): Hub, Compras e Requerimentos (`/conta`, nome no cabeçalho). Numera só tem Aparência (senha é pela Central).
- **Configurações**: toda área usa o mesmo desenho — `CabecalhoPagina` + `AbasNavegacao` + **índice de cards** (`IndiceConfiguracoes`, `components/layout/indice-configuracoes.tsx`; Compras e Requerimentos têm cópia idêntica). Frotas e Emendas ganharam o índice (antes: Frotas era uma página com seções empilhadas; Emendas redirecionava direto para a primeira aba). **Tela nova de configuração = um card no índice + uma aba.**
- Diferenças que ficam de propósito (específicas do app): detalhe do processo em folha/linha, zoom, notas, chat e aviso da plataforma (Compras); Ajuda (não existe no Requerimentos).

## Filtros imediatos em todos os módulos (06/11/2026)

Regra do dono: **nenhum filtro exige botão "Filtrar"/"Aplicar"/"Buscar"** — escolher na lista suspensa, marcar a caixa ou clicar na opção muda a tela na hora; campo de texto aplica depois de uma pausa na digitação (~350 ms; Enter aplica já).
- **Lista filtrada no servidor** (Frotas: Notas, Veículos, Manutenção; Feedback): envolver os campos em `FormularioFiltros` (`src/components/modulo/formulario-filtros.tsx`). Campos não controlados com `name`, mesmos nomes de parâmetro de antes; troca a URL com `router.replace(..., {scroll:false})` numa transição (a lista anterior fica visível, a busca não perde o foco). `limpar={{href, className, visivel?}}` desenha o "Limpar". Campos `hidden` do formulário seguem na URL.
- **Lista que chega inteira ao navegador** (Emendas): `atualizarFiltrosNaUrl` (agora em `src/lib/filtros-url.ts`, o antigo `lib/emendas/url-filtros.ts` só reexporta) + filtro em memória; gravação do texto da busca na URL com pausa de 250 ms.
- Seletor de exercício/ano usa `router.replace` (não `push`) para não empilhar histórico.
- **Tela nova com filtro = um desses dois caminhos; nunca um `<form method="get">` com botão.**
- Testado: `montarUrlComParametros` (vitest), `tsc`/`eslint`. **Não testado no navegador** (as telas exigem sessão e Supabase, que o sandbox não alcança): conferir no deploy que trocar a lista atualiza sem clicar e que o foco da busca se mantém.

## Módulo Imóveis e Consumo (6º módulo — roda DENTRO do Hub, 06/11/2026)

Pedido do dono: controlar aluguéis, contas de água e luz e a entrega dos imóveis de todas as secretarias (mockup aprovado antes de
construir; o artifact "Imóveis e Consumo" ficou como referência visual). Como Emendas e Frotas: rotas `/imoveis/*` neste repositório,
mesma sessão, schema próprio `imoveis` no projeto compartilhado. Cor `#0E7490` (texto `#0B5566`, escuro `#5EC4D9`); `MODULOS.imoveis`
tem `interno: true`.

- **Passo manual do dono (obrigatório)**: Supabase → Settings → API → Exposed schemas → adicionar `imoveis`. Sem isso toda tela falha
  (PGRST106) e o bloco "Imóveis" do formulário de acesso devolve erro.
- **Acesso = admin do Hub OU (`imoveis.usuarios` + módulo `imoveis` em `hub.acessos_modulo`)**, sem `ativo` próprio nem cascata em
  `hub.definir_acesso` (mesmo desenho do Frotas). Perfis: `gestor` (Setor de Imóveis, tudo), `consulta` (só lê) e `secretaria` (lê SÓ os
  imóveis, unidades, contas, entregas e pendências da própria secretaria; `secretaria_id` obrigatório nesse perfil, CHECK no banco).
  Para mudar o perfil de quem já tem o módulo: desmarcar e marcar de novo em Configurações → Usuários.
- **Banco** (`20261107000000_imoveis_schema.sql`, aplicada por MCP em partes `imoveis_01…05`): `secretarias`, `usuarios`, `imobiliarias`,
  `imoveis` (contrato + proprietário embutidos), `unidades` (matrícula da água / UC da luz), `contas` (uma por unidade e mês, `referencia`
  sempre dia 1), `entregas` (1:1 com o imóvel; `id` = id do imóvel), `documentos` (**sem uso, de propósito**: decisão do dono — PDFs NÃO são guardados, ver "Leitura de documentos"),
  `pendencias_justificadas`, `parametros` (1 linha, limites editáveis), `preferencias_exportacao` (sem uso ainda), `auditoria`.
  Regras no BANCO: datas da entrega em ordem, **encerrar só com água e luz desligadas, chaves, vistoria e titularidade das duas**
  (`encerra_so_com_tudo_resolvido`), conta única por unidade+mês, UC única. `imoveis.sincronizar_situacao` passa o imóvel a
  `em_entrega`/`entregue` conforme a entrega. RLS: leitura por `pode_ver_secretaria`/`pode_ver_imovel`; escrita só `eh_gestor()`.
  Funções com `revoke … from public, anon` aplicado (conferido com `has_function_privilege`). **Lição**: o MCP pede confirmação humana
  (e expira em 230 s) em `drop trigger`/`drop policy` e em `delete` dentro de bloco de teste; em schema novo basta `create` (sem `drop`),
  e `create or replace trigger` evita o `drop`. `revoke` e `alter … drop constraint` passaram direto desta vez.
- **Testado em transação desfeita** (perfis simulados): gestor vê/edita; consulta só lê; **secretaria vê só a própria secretaria** (imóveis,
  contas, unidades; entrega alheia = 0); sem acesso, conta desativada e `anon` não veem nada; `definir_acesso` barrado para secretaria;
  encerrar sem desligamento, conta duplicada e referência fora do dia 1 barrados.
- **Alertas** (`lib/imoveis/regras.ts`, puro e testado): `analisarConsumo` (média dos `meses_media` meses anteriores, mínimo 3; acima de
  `pct_acima` = crítico, abaixo de `pct_abaixo` e valor por unidade fora de `pct_valor` = atenção), `situacaoVigencia`, `etapasDaEntrega`,
  `calcularPendencias` (+ `semJustificadas`: justificativa vale só enquanto a *assinatura* do dado não muda). **Todos os limites vêm de
  `imoveis.parametros`** (Configurações → Limites dos alertas) — nunca constante no código.
- **Avisos no sino** (`20261107010000_imoveis_avisos_sino.sql`, aplicada; job `imoveis-avisar-pendencias` às 11h05 UTC = 8h05 em Brasília):
  `imoveis.avisar_pendencias()` → `hub.notificar` para os gestores (contrato, ligação ativa após a entrega, chaves sem desligamento, conta
  sem lançamento, atraso, consumo). Testado: 5 tipos, nenhuma repetição na segunda chamada. Para desligar:
  `select cron.unschedule('imoveis-avisar-pendencias')`.
- **PDF da concessionária** (`pdf-conta.ts` + `actions-contas-pdf.ts`, `/imoveis/importar`): `unpdf` lê o texto, acha a unidade pela
  matrícula/UC, propõe mês/consumo/valor/vencimento; a pessoa confere e confirma; o PDF nunca é guardado; PDF digitalizado = digitar.
  **Calibrado só com textos de exemplo**: ajustar `lerContaDoTexto` com as primeiras faturas reais do SAAE e da Energisa.
- **Telas**: Painel, Imóveis (lista com filtros imediatos; detalhe com abas Contrato · Contas · Entrega · Histórico), Água e Luz
  (consolidado + lançar), Entregas, Vencimentos, Pendências (justificar), Configurações (limites, secretarias, imobiliárias), Exportar
  (`/imoveis/exportar?r=imoveis|contas|pendencias|secretarias&formato=xlsx|pdf|csv`, sob a RLS). Todos os filtros usam `FormularioFiltros`.
- **Leitura de documentos sem guardar o PDF** (`pdf-documento.ts` + `actions-documento-pdf.ts` + `leitor-documento.tsx`, nas abas Contrato e
  Entrega do imóvel; só gestor): decisão do dono, para não ocupar espaço no banco. O servidor lê o TEXTO (`unpdf`) de um **contrato**
  (número, vigência — início+fim ou início+prazo em meses —, aluguel, dia de vencimento, índice, locador e CPF/CNPJ), de um **comprovante
  de troca de titularidade** (água/luz, unidade e data → etapa de titularidade da entrega) ou de um **laudo de vistoria** (data, vistoriador,
  resultado → etapa de vistoria), PROPÕE os campos, a pessoa confere e marca o que aplicar (`aplicarDocumento`, só grava os marcados; a
  auditoria registra a mudança). O arquivo nunca é gravado (nem banco, nem bucket, nem disco) e o limite é 5 MB. Só propõe o que achou. O
  caminho PDF → `unpdf` → leitor foi conferido com PDFs gerados de verdade; **os padrões foram escritos com textos de exemplo**: ajustar
  `pdf-documento.ts` com os primeiros contratos/laudos reais. PDF digitalizado (imagem) volta "sem texto".
- **Importação das planilhas de controle (Excel)** (`/imoveis/importar`; `lib/imoveis/importacao/{planilha-contas,plano-contas,xlsx-contas}.ts`,
  `actions-importacao-contas.ts`, `importador-planilha-contas.tsx`; só gestor): as planilhas reais da Prefeitura (**Energisa Total 2026** e
  **COPASA 2026**) têm uma aba por secretaria, vários blocos por aba ("Proj. Atividade" + cabeçalho `CDC|Matrícula · Setor · Endereço · Jan…Dez`) e,
  na Energisa, um segundo código sem cabeçalho (guardado só na leitura). **Os números mensais são VALOR em R$ (não kWh/m³)** — conferido pelos
  valores (tarifa mínima idêntica entre unidades, "valor juros"); a prévia avisa e a gravação usa `valor`, `consumo` fica nulo. Fluxo: escolhe o
  arquivo, o tipo (água/luz) e o ano → prévia (nada gravado) → por aba, a secretaria (sugerida pelo nome; SEDEGI pede escolha ou criação) → por
  linha, importar sim/não e a que imóvel ligar (sugestão por nome igual ou endereço específico; "Rua Principal S/N" não serve para casar) →
  `importarPlanilhaContas` relê o arquivo no servidor e grava: secretarias novas, imóveis novos (vínculo escolhido, aluguel 0), unidades e contas
  (`origem = 'planilha'`, `upsert … ignoreDuplicates`: **reimportar não duplica nem sobrescreve mês já lançado**, testado no banco). Parcelas de
  dívida (`VALOR JUROS`/`AMORT.` da Fazenda/COPASA) são ignoradas. Conferido com os arquivos reais: luz 194 unidades, ~1.667 contas;
  água 141 linhas (2 parcelas de dívida), ~953 contas. **Não é uma transação única**: se parar no meio, rodar de novo completa sem duplicar.
  Conferência opcional com as planilhas reais: `PLANILHAS_REAIS=/pasta npx vitest run src/lib/imoveis/importacao/planilhas-reais.test.ts`.
  **Bug pego por essa conferência**: `/cultura/` casava "AGRICULTURA" (a regra de agricultura vem antes e `^cultura` ancora).
- **Vínculo do imóvel** (`imoveis.imoveis.vinculo`: `alugado` | `proprio` | `cedido`, migration `20261107020000`): as planilhas cobrem TODOS os
  pontos de consumo, não só os alugados. Imóveis que já existiam ficaram `alugado`; os criados pela importação entram com o vínculo escolhido
  (padrão próprio) e aluguel 0. Filtro "Vínculo" na lista.
- **Alertas por VALOR** (quando a conta não tem consumo): `analisarConsumo` cai para o valor em reais (`Anomalia.base = "valor"`; pendência
  `valor_conta_{luz|agua}`, título "Valor da conta … fora do padrão") e a variação "vs. média" da área consolidada também. No sino,
  `imoveis.avisar_valores()` (migration `20261107030000`, job `imoveis-avisar-valores` às 8h10 de Brasília; testado: 1 aviso, 0 na segunda chamada).
- **Endereço pelo CEP** (`lib/cep.ts` puro e testado, `lib/cep-actions.ts`, `components/modulo/campo-endereco.tsx`; usado no cadastro de imóvel,
  reutilizável em qualquer módulo): digitou os 8 números, consulta sozinho (sem botão) a ViaCEP e, se falhar ou não achar, a BrasilAPI, e monta
  "Rua, número, complemento - Bairro - Cidade/UF - CEP 00000-000"; número e complemento recompõem na hora; o campo "Endereço" segue editável à mão
  (editou, para de recompor). **A consulta roda no servidor** (server action `consultarCep`: exige login ativo, limite de 60 por 5 min por IP em
  `hub.limites_requisicao`), então não depende de CORS nem da CSP do navegador. Sem coluna nova: o CEP fica dentro do texto do endereço
  (`cepDoEndereco` o recupera ao editar). Testado com `fetch` falso (fonte principal, reserva, não encontrado × indisponível, CEP inválido);
  **não testado contra as APIs reais** (sandbox sem internet): no primeiro uso, digitar um CEP de Cataguases e conferir.
- **Carga inicial das planilhas (07/11/2026)**: feita por SQL direto em produção (não pela tela), a partir dos dois .xlsx reais, com `luz` antes de `água`
  para o mesmo imóvel casar por nome/endereço específico: 245 imóveis (todos `vinculo = proprio`, aluguel 0), 333 unidades, 2.620 contas (`origem = planilha`,
  total R$ 1.718.884,83, igual à planilha), secretaria nova SEDEGI. **`imoveis.imoveis.revisar_motivo`** (migration `20261107040000`) guarda as dúvidas do
  cadastro, uma por linha; `calcularPendencias` gera a pendência `cadastro_revisar` ("Cadastro para revisar", atenção) enquanto o campo existir. No formulário do
  imóvel aparece o aviso com a caixa "marcar como revisado" (`salvarImovel({revisado:true})` zera o campo). Motivos gerados: vínculo/contrato/aluguel não
  informados (todos), endereço genérico (107), possível duplicidade água × luz (27 pares, mesmo número e rua/nome parecidos — **não foram unificados**), conta com
  valor R$ 0,00, secretaria criada da aba. Reimportar pela tela continua sem sobrescrever mês já lançado.
- **Ainda não feito**: escolha de colunas na exportação, tour guiado, OCR de PDF digitalizado, ligar/mesclar imóveis duplicados depois de importar
  (a prévia sugere a ligação por nome/endereço; se o nome de água e luz diferir, nascem dois imóveis para o mesmo lugar), empenho e dotação
  (as planilhas trazem FICHA/EMPENHO/VALOR EMPENHO por secretaria, ainda não lidos), vencimento e pagamento das contas importadas (as planilhas não trazem).
- **Verificado**: `tsc`/`eslint`/`vitest`/`next build` limpos; componentes (gráficos, etapas, formulário de conta) conferidos em Chromium
  (1280 e 390 px, claro e escuro) numa página de teste temporária, removida. **Não testado ao vivo contra o banco** (sandbox sem acesso a
  `*.supabase.co`/`*.vercel.app`): o primeiro uso confirma as telas e o fluxo de acesso por perfil.

## Emendas — escolhas feitas por Claude que podem ser revistas (12–13/11/2026)

Registro de tudo que foi decidido sem confirmação explícita do dono, para reavaliar depois. Cada item diz o que foi feito e como desfazer.

### Identificador contábil (art. 5º da IN TCE-MG 05/2025)
- **Escolha**: o campo `ficha` (nova dotação, ex.: `2.087.0201 - EP02 - REPASSE …`) já é uma dotação própria por emenda. O código `2.087.0201 - EP02` (ação + subação do vereador + sequência) passou a valer como identificador contábil **por derivação** (`identificadorDaFicha`, em `conformidade.ts`): não é copiado para `execucao.identificador_contabil`, que continua vazio. Vale na conformidade, no detalhe (rótulo "da dotação da emenda") e no portal (`portal.ts`).
- **Pode estar errado se**: a Contabilidade usar outro código (fonte de recurso, código único do plano de contas). O campo manual `identificador_contabil`/`fonte_recurso` continua prevalecendo se preenchido. **Para desfazer**: remover `identificadorDaFicha(...)` de `avaliarArt7` e `portal.ts`.
- **Confirmado pela Contabilidade (16/11/2026)**: o identificador é a subação da dotação + o elemento de despesa (ex.: `2.087.0201 - EP02 · elemento 43`); só o código da ficha se repete (15 casos), com o elemento são 215 únicos. `identificadorDaFicha(ficha, natureza)` monta o valor e ele prevalece sobre o campo manual; `execucao.identificador_contabil` foi regravado com o mesmo valor.

### Arredondamento de centavos
- **Limite de R$ 1,00** (escolha minha; nenhuma norma encontrada). Registro como lançamento de tipo `arredondamento_empenho`/`arredondamento_pagamento` (data = dia do registro), com o valor real na observação. Não altera `v_emendas` (empenhado/pago reais), nem o portal (filtra por tipo). Pesquisa jurídica não achou jurisprudência sobre arredondamento; princípio adotado: o empenho é o valor exato e o público vê o real. **Confirmar com o Controle Interno/TCE-MG.**
- Aplicado em 10 emendas: 18, 21, 31, 64, 68 (empenho e pagamento), 119, 161, 166, 188, 198. Não arredondadas por passarem de R$ 1,00: 57 (R$ 12,37), 97 (R$ 15,74), 212 (R$ 8,16), 17 (R$ 1,47).
- **Para desfazer**: botão "Desfazer" na aba Financeiro (ou `delete` dos lançamentos com `tipo like 'arredondamento%'`).

### Lançamentos da planilha do IPM (13/11/2026) — emendas 57, 68, 97, 161, 206, 212
- **Retenções** lançadas como `pagamento` (observação "Retenção"), porque o IPM soma retenção + valor pago.
- **Nº do pagamento** gravado como o "nº/ano" do IPM (ex.: `4703/2026`); **não é a OP** (nas outras emendas o nº do pagamento guarda a OP).
- **Liquidação não lançada** (deixou de ser fase). Empenhos 10834 e 10864 (emenda 212) removidos por "não existir no IPM" (justificativa em `exclusoes_justificadas`).
- Os lançamentos do IPM foram gravados com `usuario_id` do dono da plataforma (521180be…), não de quem de fato conferiu.
- Empenho 11662 (212) entrou "conforme IPM"; não constava na planilha da Fazenda.

### Cadastros (vereadores e beneficiários)
- **Alex Leite de Freitas** (PT) entrou como vereador **nº 16** (para não colidir com o nº 13 que as emendas do Ricardo usam), `substitui_id` = Ricardo. Não tem cota própria definida em 2026. **Willian**: gravado "Willian Jose Lourenço Jeronimo" (sem acentos, como na lista enviada).
- **Ricardo Geraldo Dias**: inativo, motivo "Mandato cassado; substituído por Alex…", partido **PV** (informado pelo dono). Emendas 134–137 seguem no nome dele e ganham o selo "Autor afastado" + pendência `vereador_afastado` (media) até concluírem.
- **CNPJ obrigatório só para entidade**; órgão público não exige (usa o CNPJ do Município); pessoa física (novo tipo, `cpf` nunca vai ao portal) exige CPF. Constraint `beneficiarios_documento_obrigatorio` criada **NOT VALID** (linhas antigas sem CNPJ não bloqueiam até serem editadas). A RPC de importação de planilha (`emendas.importar`) cria beneficiário sem CNPJ e **falhará** numa importação futura.
- **CNPJs lidos das descrições** (53 entidades, conferidos pelos dígitos verificadores). Cataguarino tinha dois CNPJs no texto: gravado o que passa no dígito verificador (27.060.184/0001-31). Surdos: o texto trazia `63.308.723\0001-72` (barra invertida), corrigido para `/`.
- **38 destinações da própria Prefeitura** (postos, escolas, CAPS, obras) estavam como "entidade" sem CNPJ e foram reclassificadas como `orgao_publico`. Cisum (consórcio) ficou como entidade sem CNPJ.
- **Exercício 2026**: nome "Prefeitura Municipal de Cataguases", CNPJ 17.702.499/0001-81 (informado pelo dono); unidade parlamentar "Câmara Municipal de Cataguases" (sugestão do relatório de pendências, não confirmada).

### Dados preenchidos a partir de texto
- **Localidade (44 emendas)**: endereço/bairro/distrito lidos da descrição quando explícitos (57, 58, 70, 105, 132, 154, 185, 196, 55, 86, 212). **Inferências**: secretarias, Defesa Civil, Catrans e CISUM receberam "Município de Cataguases" (ou "Vias públicas do Município…"), e Laboratório/Sede de Serviços Urbanos receberam a unidade + Cataguases, porque o texto não traz endereço. Ao salvar uma emenda nova, `extrairDaDescricao` também preenche localidade e CNPJ (só se vazio).
- **Finalidade e metas (206 emendas)**: texto "Finalidade: … Metas: …" montado da descrição por regra (+7 textos escritos à mão: 43, 55, 70, 86, 92, 93, 132). Quando a descrição não lista itens, a meta diz "conforme demanda a ser apresentada…, dentro do valor da emenda" (ou "a descrição não detalha itens ou quantidades"). É um preenchimento de apoio; **não substitui o plano de trabalho anexado**.
- **Gestor** das emendas 3, 4, 53, 65, 128 = "Ricardo Almeida" (planilha da Educação, coluna "gestor responsável pela execução").
- **Processo licitatório** de 8, 13, 39, 163, 172, 178, 202 (notas da planilha da Saúde) e vínculo automático com o Compras (8, 13, 39, 163, 178, 202, 75, 86, 107, 109). `salvarExecucao` passou a ligar sozinho ao Compras quando o texto tem um número que casa com um único processo (só gestor, nunca troca vínculo existente). O portal usa número de processo/contrato do Compras quando o campo próprio está vazio.

### Regras de pendência/etapa
- **"Sem andamento"** considera lançamentos, fases manuais/derivadas de dados reais, termo e processo; a fase da LOA e o parecer **não** contam como andamento.
- **Etapa (cache)** corrigida por `update` direto (sem andamento correspondente): 23, 35, 49, 128, 134, 157 → Empenhada; 18, 31, 64, 119, 166, 188, 198 → Empenhada; 191 → Indicada. Emendas 57/68/97 seguem com etapa "Paga" mesmo com pagamento parcial (o cache não foi rebaixado).
- **Valor** da emenda editável em Remanejar (com ato e motivo) e em Corrigir cadastro; **valor do lançamento** editável no lápis do Financeiro (secretaria → proposta). Reduzir empenho abaixo do já pago é barrado pelo banco.

### Pendente de decisão do dono
- Emenda 128: planilha da Educação indica pagamento em 19/06/2026 (NF 38522); não lançado. Emenda 148: troca de conta corrente pendente (não alterada). Emenda 91: pagamento em 27/07 anterior ao empenho de 30/07. Emenda 118: termo 033 × 034/2026.
- Empenhos sem data (33 emendas) dependem das datas do IPM.
- Cronograma previsto: não preenchido a partir de "calendário de 2026" (não é início/término de verdade).

### Regra do pagamento (13/11/2026, a pedido do dono)
- **Pagamento (e liquidação) fecham com o EMPENHADO, não com o valor da emenda** (`fases.ts`, `etapa-financeira.ts`, `actions.ts`). O empenho fecha com o valor da emenda. Assim, emenda 57 (empenhado e pago R$ 86.903,96 de R$ 86.916,33) tem pagamento verde cheio e empenho amarelo. Pagamento sem empenho lançado fica parcial ("Sem empenho"). O arredondamento de pagamento também é medido contra o empenhado (emenda 68: ajustado de R$ 0,07 para R$ 0,03). Aba Financeiro: "A pagar (do empenhado)".

## Emendas — painel de Pendências (17/11/2026)

Pedido do dono: dimensionar as pendências por tipo e quantidade, sem rolar a tela até a lista. A tela `/emendas/pendencias` abre com **uma única caixa** (`PainelPendencias`) acima da lista, sem espaços entre os blocos: (1) fio de 4 px no topo com a proporção alta/média/baixa da seleção; (2) linha de filtros (tipo, gravidade, secretaria, assunto, busca, justificadas, Limpar, Exportar); (3) faixa de 4 indicadores (pendências + altas, emendas afetadas "X de Y", valor das emendas afetadas, documentos faltando); (4) abas por dimensão — Área, Gravidade, Assunto, Secretaria, Tipo, Documentos — e a alternância Pendências/Emendas × R$; (5) **pizza (anel em SVG puro)** ao lado do ranking da dimensão escolhida (rolagem própria, `max-h` ~212 px). Decidido com o dono: dentro da própria tela, vale para quem já acessa Pendências (cada perfil sob a RLS), universo = pendências do sistema + documentos faltando (sem tabela nova), exporta Excel e PDF. Os chips de área saíram (a aba Área os substitui).
- **Interação**: clicar numa fatia ou linha filtra a lista (mesma URL, `replaceState`; clicar de novo limpa). Cada visão ignora o PRÓPRIO filtro para sempre mostrar todas as opções (Área ignora área e assunto). Aba com ponto = filtro ativo nela. Documentos só respondem a tipo, secretaria e busca; clicar na linha mostra os números das emendas (links para a aba Documentação). Pizza: 8 maiores fatias + "Demais" (não clicável); o centro mostra o total ou a fatia sob o cursor/foco; teclado (Enter/Espaço) funciona nas fatias.
- **Código**: `lib/emendas/painel-pendencias.ts` (puro e testado: `filtrarPendencias`, `agruparPendencias`, `porArea/Assunto/Secretaria/Tipo`, `indicadores`, `documentosFaltando`; cada emenda conta UMA vez no valor de um grupo), `lib/emendas/pendencias-dados.ts` (`carregarPendencias`, usado pela tela e pelo Excel), `components/emendas/painel-pendencias.tsx` (a caixa) e `lista-pendencias.tsx` (filtros + lista; passa a linha de filtros como `controles`). `CalculoEmenda` ganhou `documentosFaltando` (`resumo.ts`; `documentosExigidos` sem relatório de gestão; execução direta não entra). Excel em `/emendas/pendencias/exportar` (mesmos filtros; abas Resumo, Por área/assunto/secretaria/tipo, Documentos faltando e a lista). PDF = impressão: somem filtros e lista; sai o painel na aba aberta, com os filtros no cabeçalho.
- **Diferença para o registro de 16/11**: "Documentos faltando" conta o PDF ligado no Drive (ex.: termo sem PDF = 50), enquanto o registro separava "sem termo (nº e PDF)" = 40 de "nº cadastrado sem PDF" = 10. Total igual, recorte diferente.
- **Ajuste de layout (17/11/2026)**: o botão "Nova emenda" saiu da faixa de navegação **só em `/emendas/pendencias`** (`NavModulo` ganhou `ocultarAcaoEm`) e fica na linha do título da tela, acima do Exportar; nas outras telas continua na faixa. Pizza maior (196 px) e ranking com a barra esticada entre o nome e o número, mais a porcentagem em cada linha.
- **Visual**: só tokens da plataforma (`slate`, `rounded-xl`, `--modulo` violeta do Emendas, modo escuro); cores de gravidade as mesmas da lista; paleta de 8 cores para as fatias. Alvos de 44 px no celular (filtros em 2 colunas), `motion-reduce`, `tabular-nums`.
- **Cisum (17/11/2026)**: CNPJ 00.877.406/0001-57 gravado no cadastro do beneficiário (validado pelos dígitos verificadores; fonte: dado do PNCP informado pelo dono). Emendas 93, 126 e 162 deixam de ter pendência de CNPJ; segue em aberto se o instrumento é contrato de rateio e se a anuência do SUS se aplica (Jurídico).
- Verificado: `tsc`/`eslint`/`vitest`/`next build`; tela conferida em Chromium (1280 e 390 px, claro e escuro) com dados simulados numa rota temporária (removida). **Não testado com os dados reais do banco** (sandbox sem acesso a `*.supabase.co`): conferir no deploy se os totais batem com o registro de 16/11 e se o Excel baixa.
- **Armadilha**: `next dev`/`next build` reescrevem o `CLAUDE.md` e criam `AGENTS.md`, e na primeira execução param com um aviso de versão do Next (repetir o comando). Para limpar, apagar `AGENTS.md` e desfazer o `CLAUDE.md` **antes** de editá-lo; nunca rodar `git checkout CLAUDE.md` depois de editar (apaga a edição).

## Emendas — instrumento da parceria: convênio (contrato de rateio) × termo de fomento (17/11/2026)

Pedido do dono, a partir do Cisum (emendas 93, 126 e 162, tipo "ente"): o instrumento deles não é termo de fomento (MROSC), é convênio / contrato de rateio (consórcio público, Lei 11.107/2005 e Decreto 6.017/2007), e a plataforma cobrava termo, plano de trabalho e extrato do art. 38 da Lei 13.019.
- **Banco** (`20261117000000_emendas_instrumento_convenio.sql`, aplicada por MCP): `emendas.execucao.instrumento` (`termo_fomento` padrão | `convenio`) e o tipo `convenio` em `documentos_drive` (CHECK). As 3 emendas do Cisum já estão `convenio`. `drop constraint`+`add constraint` num só `alter table` passou pelo MCP.
- **Regra por instrumento** (um lugar só, para ajustar com o Jurídico): `documentosExigidos(..., { instrumento })` em `documentos-drive.ts` — convênio exige `convenio` + `extrato` (publicação, base IN TCE-MG 05/2025 art. 7º, VIII) + relatório de gestão (+ anuência do SUS na saúde); sem termo nem plano. `fases.ts`: fase "plano" vira `nao_se_aplica` e "termo" ganha o nome "Convênio (contrato de rateio) assinado". `pendencias.ts` + `base-legal.ts` (`BASE_DA_PENDENCIA_CONVENIO`): mesmas pendências, sem citar a Lei 13.019 (publicação, conta, vigência — sem cobrança de prestação em 90 dias). `conformidade.ts` (item IX): o convênio anexado cumpre o papel do plano, metas continuam obrigatórias. Portal (`portal-verificacao.ts`): plano e extrato do art. 38 não são cobrados do convênio; a ficha pública do convênio e da sua publicação não cita a Lei 13.019.
- **Tela**: Parceria e execução → "Instrumento da parceria" (só em emendas tipo ente; gestor grava direto, secretaria vira proposta). Anexos → tipo "Convênio / contrato de rateio".
- **Ainda não feito**: o PDF do contrato de rateio (`Cisum Contrato de Rateio - CATAGUASES.pdf`, em Documentos novos) NÃO foi tarjado nem ligado. Ele é o contrato geral de custeio de 2026 (R$ 583.980,41, per capita R$ 0,73, 01/01 a 31/12/2026) e a cláusula 12.3 diz que exames e consultas extra cota ficam fora e são pagos por nota fiscal; os objetos das 3 emendas são exames/consultas/cirurgias. O Jurídico precisa dizer se o contrato cobre as emendas antes de ligá-lo como instrumento delas. Se for ligado: tarjar CPF do Prefeito (pág. 1) e os CPFs do carimbo de assinatura digital (`:04569372694`, `:48857572668`).
- Testes novos em `documentos-drive`, `fases` e `pendencias` (359 passam); `tsc`/`eslint` limpos.

## Emendas — categoria do beneficiário, "Novo beneficiário" e importação de documento (17/11/2026)

Pedido do dono: a entidade precisa carregar origem e tipo, e isso deve se refletir onde ela aparece. Decisões dele: a tela continua "Beneficiários"; a categoria SUGERE (não trava); ao cadastrar dá para importar dados de um documento, **sem guardar o arquivo**.
- **Banco** (`20261117010000_emendas_beneficiarios_categoria.sql`, aplicada por MCP em comandos separados): `beneficiarios.categoria` (`osc` | `saude_sus` | `consorcio` | `ente_publico` | `orgao_municipal` | `pessoa_fisica`, NOT NULL padrão `osc`), `endereco`, `email`, `telefone`, `representante` (uso interno; nada disso vai ao portal) e `v_emendas.beneficiario_categoria` (no fim da view, `security_invoker` mantido). Carga: órgão público → `orgao_municipal`; Cisum → `consorcio`; Hospital → `saude_sus`; IEF → `ente_publico`; o resto `osc`. `tipo` (entidade/órgão/pessoa física) continua validando o documento e agora é derivado da categoria.
- **Regra num só lugar** (`lib/emendas/categorias.ts`, pura e testada): `INFO_CATEGORIA` (nome, cor, tipo, sugestão de tipo de execução e instrumento), `sugestaoDaCategoria`, `categoriaPelaNaturezaJuridica`, `conflitoInstrumento`. Sugestões: OSC → osc + termo de fomento; Saúde/SUS → ente + termo; consórcio e ente público → ente + convênio; órgão da Prefeitura → execução direta.
- **Onde aparece**: selo (`CategoriaSelo`) na lista e no detalhe da emenda, filtro "Categoria do beneficiário" na lista (`?cat=`), coluna no relatório por beneficiário, "Natureza do beneficiário" no portal, pendência nova `instrumento_incompativel` (média; consórcio/ente público com termo de fomento ou OSC com convênio; só sinaliza).
- **Cadastro**: Configurações › Beneficiários tem "Novo beneficiário" e filtro por categoria (`config/editor-beneficiarios.tsx`, `salvarBeneficiario` cria e atualiza; recusa CNPJ/CPF repetido). No formulário da emenda, a categoria do beneficiário escolhido sugere o tipo de execução (a pessoa pode trocar) e, em emenda nova, consórcio/ente público já nasce com instrumento convênio (`aplicarSugestaoDaCategoria`).
- **Importar de documento** (`lib/emendas/leitor-beneficiario.ts` + `actions-beneficiario.ts`): o servidor lê o TEXTO do PDF (`unpdf`, até 5 MB, só PDF com texto; digitalizado volta "sem texto") e a tela preenche nome, CNPJ (validado), endereço, e-mail, telefone, representante e categoria (pela natureza jurídica do cartão do CNPJ ou pelo nome); a pessoa confere e salva. O arquivo nunca é guardado e o CPF não é lido. **Calibrado só com textos de exemplo**: ajustar `lerBeneficiario` com os primeiros cartões do CNPJ reais.
- **Dado a decidir**: o IEF (emenda 70) é ente público com instrumento padrão (termo de fomento) e por isso aparece na pendência nova; o gestor decide se vira convênio. Projeto Superação segue como OSC (A06 depende do Jurídico).
- Ficha das 3 emendas do Cisum corrigida de "RATERIO" para "RATEIO" (só o texto; o código da dotação não mudou).



## Frotas: Manutenção × FIPE e correção do botão da FIPE (18/11/2026)

- **Botão "Atualizar valores da FIPE" não funcionava**: o código da API conferia com a spec v2 da Parallelum, então a causa provável é de execução: 25 consultas em série (até 12 s cada) estouravam o tempo da função, e sem token o limite da FIPE (500/dia) é dividido com todos os outros usuários do mesmo IP da Vercel (429). Agora `atualizarValoresFipe` faz rodadas de 8 em paralelo (4 por vez, consulta repetida de mesmo modelo/ano reaproveitada), a tela repete as rodadas sozinha, mostra o motivo da falha (`motivo`) e para no limite; `maxDuration = 60` em Veículos e Manutenção × FIPE. **Passo do dono**: criar um token gratuito em fipe.api.br e pôr em `FIPE_API_TOKEN` na Vercel (sem ele o 429 volta). Não testado contra a API real (o sandbox bloqueia `fipe.parallelum.com.br`).
- **`/frotas/custos` (Manutenção × FIPE)**: `lib/frotas/custos.ts` (puro, testado): período (12 m, 24 m, ano, tudo), gasto do período e acumulado por veículo, ano a ano, % do valor FIPE com os mesmos limites de `frotas.parametros`, valor "desatualizado" (> 45 dias) e veículos sem valor listados à parte. Complementa a Análise da frota (que só olha 12 meses de quem já tem valor). Ainda sem exportação própria.

- **Causa real do "atualizou mas não aparece" (18/11/2026)**: nenhum veículo estava ligado à FIPE (`fipe_ano_id` nulo nos 100%), então "Atualizar valores" não tinha o que atualizar — ele só refaz quem já foi ligado. Novo `ligarVeiculosFipe` (`actions-importacao.ts`): em rodadas de 5, procura a marca, o modelo (só se o melhor tem ≥ 0,75 de semelhança e 0,15 de vantagem sobre o segundo) e o ano do cadastro, grava o vínculo e o valor; o que ficou em dúvida volta numa lista "escolher na mão" (Procurar na FIPE no veículo). Fora: alugados, máquinas, valor digitado na mão. `atualizarValoresFipe` agora avisa quando nada está ligado.

## Emendas — conciliação com o IPM: sem arredondamento (18/11/2026)

Orientação do Controle Interno (CGM): **não há tolerância legal** para diferença de valor; empenhado e pago ficam **sempre exatos**. Isto **substitui** a seção "Arredondamento de centavos" acima: o botão "Arredondar centavos" e a action `arredondarCentavos` foram removidos e os 11 lançamentos `arredondamento_*` de 10 emendas foram apagados do banco (o tipo continua aceito no código só para leitura de registros antigos).
- **Banco** (`20261118020000_emendas_conciliacao_ipm.sql`, aplicada por MCP; `create or replace function` passou desta vez): `emendas.conciliacoes` (1 linha por emenda, só existe onde há o que registrar; RLS: lê quem vê a emenda, escreve só gestor): `saldo_registrado_em`/`saldo_valor`/`saldo_observacao` (saldo não executado), `anulacao_solicitada_em`/`_documento`/`_valor` (anulação do saldo do empenho a fazer no IPM), `excesso_fonte`/`_documento`/`_valor` (fonte de recurso que cobriu o excesso). **`emendas.validar_movimento` agora aceita empenhado acima do valor da emenda SÓ quando `excesso_fonte` está preenchida** (antes barrava sempre).
- **Regra pura** `lib/emendas/conciliacao.ts` (`situacaoConciliacao`, testada): saldo não executado = valor − empenhado, só quando a emenda está paga com tudo o que foi empenhado pago, ou encerrada (empenho/pagamento parcial com a emenda em andamento NÃO conta: pode vir novo empenho); saldo do empenho a anular = empenhado − pago, só com a execução encerrada (prestação de contas/concluída) ou anulação já solicitada; excesso = empenhado − valor. **O saldo registrado guarda o valor do momento**: se o empenho mudar, o registro deixa de valer e a pendência volta.
- **Pendências** novas (`pendencias.ts`): `saldo_nao_executado` (média), `anular_saldo_empenho` (média; some sozinha quando a Anulação de empenho é lançada, porque o empenhado passa a ser igual ao pago), `excesso_sem_fonte` (alta; com a fonte informada some também `empenho_maior`). Base legal em `BASES.conciliacao` (Lei 4.320 arts. 58–60 + orientação da CGM; a redação é nossa, conferir com o Controle Interno).
- **Fases**: o empenho fecha com (valor da emenda − saldo registrado), então registrar o saldo deixa o empenho 100% com a frase "saldo não executado registrado" no balão.
- **Tela**: `PainelConciliacao` na aba Financeiro, só aparece quando há o que registrar, e cada bloco só no caso que se aplica (saldo / anulação / excesso). Para o gestor há um link discreto "Registrar como saldo não executado" quando há empenho e sobra valor sem empenhar (empenho encerrado com saldo). `salvarConciliacao` (actions.ts) só gestor.
- **Fluxo da anulação**: o painel indica o valor a anular; a Contabilidade anula no IPM; o gestor registra a solicitação (data + documento) e, depois de feita, lança a **Anulação de empenho** em "Lançar movimento" — o aviso some sozinho.
- **Ainda não feito**: o portal público segue mostrando empenhado/pago exatos (sem o saldo); exportações (Excel/PDF) ainda não trazem as colunas de saldo/fonte do excesso.
- **Desfazer e tela Saldos (18/11/2026)**: `desfazerConciliacao` (actions.ts, só gestor; bloco `saldo`/`anulacao`/`excesso`; apaga a linha se ficar vazia) e botão "Desfazer" em cada bloco do painel, que foi redesenhado (quadro de valores, etiquetas de estado com texto + cor, passos da anulação, alvos de 44 px no celular). **`/emendas/saldos`** (item "Saldos" no menu; `lib/emendas/saldos.ts` puro e testado: `linhasDeSaldo`, `totaisDeSaldo`, `porSecretaria`, `temTipo`) consolida os saldos de todas as emendas para a Contabilidade — saldo não executado (registrado × a registrar), empenho a anular (solicitado × não) e excesso (com/sem fonte) —, com filtros por secretaria e tipo (`FormularioFiltros`), totais e Excel em `/emendas/saldos/exportar` (abas Resumo, Por secretaria, Por emenda). A conciliação da emenda 5 registrada por engano pelo dono foi desfeita no banco.


- **Aba Financeiro enxuta (18/11/2026)**: `CartoesFinanceiros` (`painel-conciliacao.tsx`, substitui o antigo `PainelConciliacao`) mostra 5 cartões com "?" (`DicaAjuda`, com `alinhar`): valor, empenhado, pago, a pagar e sem empenhar (vira "Acima da emenda" se empenhado > valor). As ações da conciliação são botões sob o cartão correspondente, só quando o valor ocorre: saldo não executado (sob Sem empenhar; justificativa opcional após o clique; em andamento o gestor vê "Encerrar empenho com saldo"), anulação (sob A pagar) e fonte do excesso (sob Acima da emenda). Cartão "Liquidado" removido.

- **Encerramento da emenda e Panorama da execução (19/11/2026)**: `emendas.encerramentos` (1 linha por emenda, só gestor escreve; migration `20261119000000`) guarda a situação: `cumprida`, `cumprida_economia` (no repasse = devolução de saldo, com valor/data/comprovante da devolução), `nao_cumprida` ou `restos_a_pagar`. Regras puras em `lib/emendas/encerramento.ts` (`validarEncerramento`, `linhasPanorama`, `totaisPorCartao`): cumprida exige o documento que comprova (`nota_fiscal` na execução direta, `prestacao_contas` no repasse, ligados na Documentação — tipos novos em `documentos_drive`, internos, nunca no portal); **restos a pagar só vale para empenho não pago** (Lei 4.320, art. 36), valor não empenhado volta ao caixa e a emenda continua cumprida ("cumprida com economia"). `salvarEncerramento` registra junto o saldo não executado da conciliação quando sobra valor sem empenhar. UI: botões sob os cartões da aba Financeiro (`FormEncerramento` em `painel-conciliacao.tsx`; o botão antigo de saldo foi absorvido por ele). `/emendas/panorama` (antiga Saldos, que redireciona): cartões-filtro (`?c=`), quadros por secretaria/vereador/tipo, Excel e PDF em `/emendas/panorama/exportar`; resumo no Painel. **Decisões do dono**: liquidação continua fora das fases (controle contábil é do IPM); portal público não mostra a situação (só se virar exigência legal); quem marca é gestor/admin, a regra deve ficar num ponto só para o futuro "gestor master". **Próximos PRs combinados**: (B) seletor de exercício global + restos a pagar visíveis no ano seguinte; (C) assistente de abertura de exercício (importar planilha de emendas e de ajustes, cadastro de entidade pela BrasilAPI).

- **Seletor de exercício global e restos a pagar entre anos (19/11/2026, PR B)**: `SeletorExercicio` (`components/emendas/seletor-exercicio.tsx`, no layout de `/emendas`) troca o ano de todas as telas: grava o cookie `emendas_ano` (`lib/emendas/exercicio-cookie.ts`) e põe `?ano=` na URL; `resolverExercicio` passou a usar a ordem URL → cookie → exercício aberto mais recente. O seletor do Painel continua válido (o seletor global acompanha o `?ano=`). Exercício encerrado só mostra um aviso: **não bloqueia lançamentos**, porque restos a pagar de um ano encerrado ainda recebem pagamentos. `linhasPanorama` trata restos a pagar todo pago como cumprida (só na leitura, `restosQuitados`), e `carregarRestosAnteriores` lista no Panorama do ano seguinte os restos de anos anteriores (e na aba "Restos de anos anteriores" do Excel). **Guia de uso para o tutorial: `docs/guia-funcionalidades-emendas.md`** (atualizar a cada funcionalidade nova do módulo).

- **Abertura de exercício, ajustes pós-exequibilidade e CNPJ (19/11/2026, PR C)**: `AssistenteExercicio` (Configurações › Exercício; `abrirExercicio` copia cota/Saúde/RCL/dados do Município, nunca LOA/lei/prazo/publicação; `fecharExercicio` exige justificativa se há emenda sem situação de encerramento e **não bloqueia lançamentos**; `reabrirExercicio`). `ImportadorAjustes` + `previaAjustes`/`aplicarAjustes` (`actions-config.ts`, regra pura em `importacao/ajustes.ts`): compara a planilha atualizada com o cadastro (valor, objeto, ficha, dotação, destinação; célula vazia não apaga), o gestor marca, e cada mudança vira `emendas.remanejar` (via `remanejarEmenda`) com ato e motivo; emendas novas entram pela RPC `importar`; as que sumiram só são canceladas se marcadas. O servidor refaz a comparação (não confia na prévia do navegador). `consultarCnpj` (`actions-cnpj.ts` + `lib/cnpj.ts`, BrasilAPI, gestor, 40/5 min por IP) preenche o beneficiário; **não testado contra a API real** (sandbox sem internet; só o parser e o tratamento de erro têm teste). Ainda não feito: perfil de gestor master e bloqueio de lançamentos em ano encerrado.

- **Gestor master e exercício encerrado protegido (20/11/2026)**: `emendas.masters` (usuario_id; só o admin da Central insere/apaga, RLS; migration `20261120000000`) + regra única em `lib/emendas/master-regra.ts` (`podeDecidirComoMaster`: admin sempre; com algum master cadastrado só ele; **sem nenhum, gestores seguem decidindo**) e `exigirDecisor()` (`master.ts`), usada por `salvarEncerramento`/`desfazerEncerramento`, `abrir/fechar/reabrirExercicio`, `salvarExercicio` e as quatro ações de importação (prévia/confirmar e prévia/aplicar ajustes). Designar: `definirMaster` (Configurações › Usuários e permissões, só admin; a pessoa precisa ser gestor). A regra é **de aplicação** (RLS de `encerramentos` continua `eh_gestor`). Exercício encerrado: gatilho `a_bloquear_exercicio_encerrado` em `movimentos_financeiros` (só `pagamento`/`anulacao` de emenda com encerramento `restos_a_pagar`; testado em transação desfeita) + `MSG_ENCERRADO` nas ações de andamento, cadastro/edição, remanejamento e cancelamento. Reabrir o exercício libera tudo de novo.

## Emendas — motivo das pendências, painel da lista e abas do topo (21/11/2026)

Pedido do dono: (1) estratificar a causa de uma pendência ("datas fora de ordem": quais?) e outros casos assim; (2) dashboard na aba Emendas como o de Pendências, com os filtros que já existem lá; (3) mais destaque às abas do topo.
- **Motivo** (`Pendencia.motivos`, `pendencias.ts`): assunto = família da regra; motivo = causa específica dentro dele, com chave que começa pela regra (`data_fora_de_ordem:extrato>paga`, `publicidade_incompleta:VIII`, `vigencia:prestacao_atrasada`, `relatorio_gestao:vencido`, `tipo_incoerente:*`, `instrumento_incompativel:*`). Assunto de causa única não tem motivo. **Regra nova com causas distintas = preencher `motivos` no `add(...)`.** Uma pendência pode ter vários motivos e conta em cada (publicidade). Painel de Pendências: aba e filtro `m` ("Motivo"; trocar assunto/área zera o motivo), `porMotivo` (lib, com `comAssunto` para prefixar o assunto, sem repetir quando o motivo já o diz), select na lista, chips no cartão e no detalhe da emenda, aba "Por motivo" e coluna "Motivo" no Excel. Justificativa continua por `regra` (já era específica de cada par de datas).
- **Painel da lista** (`components/emendas/painel-lista.tsx` + `lib/emendas/painel-lista.ts`, puro e testado; **refeito em 22/11/2026, ver "Uso do espaço" abaixo**): indicadores, abas por dimensão, pizza + ranking, medida Emendas/Valor/Pago. Tabela e painel usam a mesma `filtrarEmendasLista`; cada visão ignora o próprio filtro.
- **Abas do topo** (`NavModulo`, compartilhado por Emendas, Frotas e Imóveis, para seguir o padrão único): aba ativa = pílula com fundo suave na cor do módulo (`color-mix` de `--modulo`), texto `--modulo-tinta` e barra de 3 px; inativas em `slate-700`, `font-medium`, com realce ao passar o mouse; faixa com borda mais forte e sombra leve. As abas de tipo da lista usam o mesmo desenho (tinta na cor do tipo).
- Verificado em Chromium (1280 e 390 px, claro e escuro) com dados simulados numa rota temporária (removida); `tsc`/`eslint`/`vitest` (426) limpos. **Não testado com os dados reais** (sandbox sem `*.supabase.co`): conferir no deploy se os motivos aparecem nas pendências reais e se os totais do painel batem com a lista.

## Zoom do texto (22/11/2026)

Pedido do dono: "estou achando as letras pequenas": zoom eficaz e inteligente num botão discreto nas páginas da plataforma. Junto, ele perguntou se o painel de gráficos da aba Emendas repetia os filtros acima. **Erro meu**: a pergunta era sobre a CAIXA DE FILTROS (o "dele" era ela) e eu retirei o dashboard; o commit errado foi desfeito antes do merge.
- **Mecanismo** (`lib/zoom.ts`, puro e testado): muda o `font-size` do `<html>` em **%** (100% = fonte padrão do navegador, então quem já aumentou a fonte parte dela). Passos `100/110/125/150/175/200`. Tudo na plataforma é `rem`, então texto e espaços acompanham. **Para isso, os 246 `text-[Npx]` do código e os `font-size: Npx` dos CSS foram convertidos para `rem`** (n/16; inclusive as regras do modo escuro em `globals.css`): **tamanho de letra novo = `text-[0.8125rem]` ou classes do Tailwind, nunca `px`**, senão essa letra fica de fora do zoom. O tamanho da pizza também virou `rem`. Não se usa a propriedade CSS `zoom` de propósito (não dispara os breakpoints, confunde `100vh` e posições do tour).
- **Inteligente**: o valor guardado é a PREFERÊNCIA (`localStorage["zoom"]`, por navegador, **não vai ao banco**: o tamanho certo depende da tela de cada aparelho); o que vale é `zoomAplicado = min(preferência, limiteDoZoom(larguraDaTela))`, com largura útil mínima de 280 px (celular de 390 px: até 125%; notebook: até 200%). Girar o celular ou redimensionar a janela reaplica o limite sem perder a preferência; outra aba do mesmo navegador acompanha (evento `storage`). `SCRIPT_ZOOM_INICIAL` (no `<head>`, testado executando o próprio script) aplica antes da pintura, sem a página "pular". Impressão sempre em 100% (`@media print`).
- **Botão** (`components/layout/controle-zoom.tsx`): ícone "Aa" no cabeçalho, depois do modo escuro, com ponto na cor do módulo quando o zoom não é 100%; painel com A−/A+, passos prontos (os que não cabem ficam desativados, com explicação), exemplo ao vivo, "Voltar ao padrão", Esc fecha e devolve o foco, teclas `+`, `-` e `0` com o painel aberto. Nas páginas **sem** cabeçalho (login, portal público…) aparece uma versão flutuante no canto inferior direito, montada no layout raiz e escondida por CSS (`body:has(.cabecalho-escuro) .zoom-flutuante`) quando há cabeçalho. Também em Minha conta → Aparência (`AjusteZoom`).
- **Achado de carona**: os campos de filtro da lista de Emendas estouravam a largura no celular com texto maior (o rótulo não encolhia abaixo do `select`); rótulos agora com `min-w-0 max-w-full`.
- **Fora deste repositório**: Compras, Requerimentos e Numera ainda não têm o zoom; é o mesmo esquema (`lib/zoom.ts`, script do `<head>`, botão, conversão de `px` para `rem`) e deve ser portado se o dono quiser a paridade.
- Verificado em Chromium com a tela real de Emendas simulada (1280 e 390 px; 100, 150, 200% e a preferência de 175% limitada a 125% no celular): a fonte raiz muda, a preferência sobrevive ao recarregar e chega à outra aba, só um botão fica visível por página, sem rolagem horizontal. **Não verificado**: leitor de tela e o tour guiado (driver.js) com zoom alto; os textos do driver.js seguem em `px` (só o portal público foi convertido).

## Uso do espaço nas telas (22/11/2026)

Pedido do dono (com capturas): tirar a caixa de filtros e manter o dashboard; "perdemos espaço com apenas 1 botão"; palavras cortadas; telas mais amplas e intuitivas; depois, "otimize o uso dos espaços em todas as telas".
- **Regra**: filtro que o gráfico já faz NÃO tem seletor. Clicar em aba/fatia/linha filtra; os filtros ativos aparecem em chips com ✕ e "Limpar tudo" (`components/emendas/filtros-ativos.tsx`, nos dois painéis). A barra do painel só tem o que o gráfico não faz: busca e ordem (lista) ou busca, "Incluir justificadas" e Exportar (Pendências), tudo numa linha.
- **Lista de Emendas**: dimensões = Etapa, Vereador, Secretaria, Situação financeira, Beneficiário, Saúde, Pendência, Situação, Remanejamento (Tipo é das abas Consolidado/Direta/OSC/Ente, acima). KPI "N com pendência" é botão (filtro `p`). Rótulos do ranking quebram linha em vez de cortar. "Nova emenda" e "Exportar" na linha do título (`podeCriar` vem da página).
- **Cabeçalho**: o seletor de exercício agora mora na barra escura, ao lado do nome do módulo (`CabecalhoHub contexto`); antes ocupava uma linha inteira só para ele. Aviso de exercício encerrado ficou na página (`AvisoExercicioEncerrado`). A faixa de abas não leva mais "Nova emenda" (era o botão que quebrava para uma linha sozinho).
- **Larguras e margens** (uma definição só, `LARGURA_MODULO`/`MARGENS_MODULO` em `components/modulo/tema.ts`): módulos Emendas/Frotas/Imóveis e a faixa de abas = `max-w-[90rem]`, margem vertical menor; Configurações e Feedback `max-w-6xl`; Início `max-w-7xl`; Conta/Novidades margens menores; hero `CabecalhoPagina` mais baixo. Removido o seletor de exercício duplicado do Painel de Emendas.
- Verificado em Chromium com dados simulados (1440, 1280 e 390 px): sem rolagem horizontal, sem texto cortado. **Não verificado**: Frotas/Imóveis/Configurações com dados reais (só mudaram larguras e margens).

## Emendas — filtros persistentes, indicadores claros e velocidade (23/11/2026)

- **Filtros da lista**: `useFiltrosUrl` (`components/emendas/use-filtros-url.ts`) é a fonte da verdade na tela (estado local, resposta no mesmo quadro); a URL só espelha por `replaceState` (busca com pausa de 250 ms). Antes, a tela esperava o roteador reemitir `useSearchParams` dentro de uma transição, e o clique "agarrava". Os filtros ficam em `sessionStorage` (por aba do navegador, junto do exercício): quem chega sem filtro na URL (aba "Emendas" do menu, "Voltar para a lista") os recupera. Usado na lista de Emendas e em Pendências; Conformidade e Painel ainda usam `atualizarFiltrosNaUrl`.
- **Linha de filtros ativos** (`FiltrosAtivos`) existe sempre, com altura fixa (a dica "Nenhum filtro aplicado…" ocupa o lugar dos chips): o chip surgir empurrava o gráfico e o clique seguinte caía fora.
- **Indicadores**: "Pago" detalha de onde vem (totalmente pagas + pagas em parte); legenda do valor indicado (pago / empenhado a pagar / sem empenho); medidas "Valor indicado" e "Valor pago" com frase explicando cada uma; na aba Situação financeira, a frase define as classes. A aba com filtro mostra um selo com o valor escolhido e a cor dele.
- **Velocidade**: `staleTimes.dynamic = 45 s` em `next.config.mjs` (voltar a uma tela já vista é instantâneo; gravação com revalidação esvazia o cache; mudança feita por outra pessoa demora até 45 s) e `obterUsuarioAtual` usa `getClaims()` (o middleware já validou com `getUser()`: uma ida à rede a menos por página). **Não medido em produção**: os logs da Vercel não foram lidos (o conector exige autorizar o time); se ainda houver lentidão, abrir a tela e ler `[tempo]` nos logs logo em seguida.
- Medido em Chromium (build de produção, 215 emendas simuladas): clique em fatia/linha ≈ 50–85 ms até pintar; filtros restaurados ao reabrir a lista.

## Padrão único de filtros (23/11/2026) — vale para TODA tela com filtro, em qualquer módulo

Regra do dono: nenhuma tela ou módulo filtra de um jeito próprio. Dois caminhos, **mesmo comportamento** (resposta imediata, recorte na URL, lembrado ao voltar de um detalhe, "Limpar"):
- **Lista que chega inteira ao navegador** (Emendas: lista, painel, pendências, conformidade): `useFiltrosUrl(chave, contexto)` de `components/modulo/use-filtros-url.ts`. Estado local manda; a URL só espelha por `replaceState`; `sessionStorage` guarda o recorte por aba (`filtros-lista:<chave>`), reaplicado quando a tela abre sem filtro na URL. `contexto` = exercício (recorte de um ano não vale para outro). Busca: `definir({q}, true)` (URL com pausa).
- **Lista filtrada no servidor** (Frotas, Imóveis, Feedback, Panorama): `FormularioFiltros` (`components/modulo/formulario-filtros.tsx`), que agora também guarda o recorte (`filtros-lista:<caminho>`) e o reaplica ao chegar sem filtro (preenche os campos e faz `router.replace`). A volta é rápida pelo cache do roteador (`staleTimes`).
- **Tela nova com filtro = um desses dois.** Nunca `useSearchParams` + `replaceState` direto, nem `<form method="get">` com botão. O portal público (`portal-emendas.tsx`) já usava estado local + URL e não guarda recorte entre visitas (de propósito: visitante anônimo). Não verificado no navegador: o reaplicar do `FormularioFiltros` (só `tsc`/`eslint`); conferir em Frotas/Imóveis/Feedback ao abrir um item e voltar.

## Rodada de otimização (19/11/2026, executada de madrugada por agendamento)

- **Velocidade**: detalhe da emenda (`emendas/[id]/page.tsx`) e do imóvel (`imoveis/imoveis/[id]/page.tsx`) agora disparam contexto e leituras independentes juntas (antes: contexto → leituras → processo/exercício/pareceres em cascata). Páginas de lista/painel já eram dependentes por natureza (emendas → cálculos).
- **Código morto**: varredura de exports sem nenhum uso (grep por nome em `src`): só 5 achados e removidos (`MESES_ROTULO`, `NOME_CURTO_INSTRUMENTO`, `NOME_TIPO_BENEFICIARIO`, `SITUACOES_FINANCEIRAS`, `porGravidade`). Tipos exportados usados só no próprio arquivo ficaram (inofensivos).
- **Dados/segurança**: Server Actions sem zod (`abrirModulo`, `alternarBloqueioLoginDireto`, `aprovarSolicitacao`, `recusarSolicitacao`) passaram a validar a entrada (módulo no catálogo, uuid, tamanho da observação). Logs conferidos: só mensagens de erro, sem e-mail, CPF, senha ou token. Demais actions já validam com zod.
- **Não feito**: logs reais da Vercel (conector sem autorização), medição de velocidade contra o banco real, revisão visual de cada tela do Frotas/Imóveis/Configurações (nada mudou de layout), auditoria de RLS nova (sem tabela nova). Cache do roteador (45 s) e `getClaims()` seguem como na rodada anterior.

## Correções de tela (19/11/2026)

- **Bug real**: a aba "Beneficiário" do painel da lista de Emendas aparecia vazia porque `COLUNAS_RESUMO` (`lib/emendas/dados.ts`) não trazia `beneficiario_categoria` (a view tem a coluna; a lista é a única que seleciona colunas à mão). **Coluna nova de `v_emendas` usada nas telas = entrar em `COLUNAS_RESUMO`.** O painel de Pendências não tem aba Beneficiário (só Área, Gravidade, Assunto, Motivo, Secretaria, Tipo, Documentos).
- **Panorama** (`emendas/panorama/page.tsx`): os quatro grupos de cartões são quadros lado a lado (2 por linha em tela larga) e os cartões crescem para preencher a linha (`flex-1`), sem sobra em branco; "Por secretaria/vereador/tipo" viraram abas por link (`?q=`), uma tabela de cada vez.
- **Conformidade**: bloco "Para que serve esta tela" (3 passos), legenda em cada indicador, "Art. 7º, V" no lugar do numeral solto e nomes dos itens faltantes em chips nas emendas.
- **Vercel**: o conector está autorizado (time "Renault's projects", projeto `centraltech`). Logs de runtime da Hobby só guardam 1 h; sem uso recente não há `[tempo]` para ler. Único erro em 24 h: regra de negócio do banco (pago acima do empenhado, esperado).

## Cache curto das leituras de Emendas (19/11/2026)

Medido nos logs da Vercel (projeto `centraltech`, produção): cada aba (Painel, Conformidade, Lista…) refazia as mesmas consultas — `emendas` ≈ 0,55–1,1 s e, no cálculo, `movimentos`, `documentos`, `execucoes`, `fases-justificativas`, `conciliacoes`, `vereadores` entre 0,6 e 1,5 s cada (em paralelo, então a página levava ≈ 1,5–2,5 s). Agora:
- `lib/emendas/cache-dados.ts` (`lerComCache(nome, escopo, ler)`): `unstable_cache` de 60 s, chave = nome + exercício + **id da pessoa**; a leitura que preenche o cache roda com o **token da própria pessoa** (`clienteFixo`, AsyncLocalStorage; `criarClienteEmendas` o usa quando existe), então a RLS continua valendo e o token não entra na chave nem no valor. Falha no cache = leitura direta como antes.
- Usado em `calcularEmendasDoExercicio` (todas as leituras) e em `listarEmendasEmCache(ano)`, que as **telas de consulta** usam (lista, painel, pendências, conformidade, panorama, relatórios, vereadores, secretarias). **Ações que decidem algo a partir da lista usam `listarEmendas` (sempre fresca).** O valor guardado precisa ser JSON (sem `Map`/`Set`: `listarDescricoes` é convertida para lista).
- Invalidação: `updateTag(TAG_DADOS)` em toda gravação — as ações de Emendas importam `revalidarCaminho as revalidatePath` de `lib/emendas/invalidar.ts`, que expira o cache e revalida o caminho. **Ação nova com escrita = usar esse import** (ou chamar `invalidarDadosEmendas()`). Só mudança por fora do app (SQL direto) leva até 60 s para aparecer; permissão revogada idem.
- **Não testado contra o banco** (sandbox sem acesso): conferir no deploy que a 2ª aba abre bem mais rápido, que gravar atualiza na hora e que um perfil restrito só vê o que a RLS libera. Cada entrada do cache de dados tem limite de 2 MB (execuções e documentos são as maiores).

## Busca por relevância (19/11/2026)

`pontuarBusca` (`lib/emendas/painel-lista.ts`, testada em `busca-relevancia.test.ts`): número igual ao digitado (1000) > começa com (700) > contém (450) > começo de palavra no objeto (300) / em beneficiário, vereador, secretaria, unidade, ficha (200) > meio de palavra (100/50); várias palavras somam. A lista de Emendas (ordem padrão "Número") e Pendências ordenam por isso quando há texto na busca; empate cai na ordem de antes. Outra ordem escolhida em "Ordenar por" prevalece. Busca nova em outra tela = reutilizar `pontuarBusca`.

## Entrada de documentos novos do Drive (19/11/2026)

Procedimento fixo, decidido com o dono, em `docs/procedimento-documentos-novos.md`: ler o documento e identificar a emenda; tarjar (PyMuPDF, CPF/RG) e subir a cópia na pasta PUBLICIDADE com o nome padrão (`E{NNN} - TERMO - {NNN}-2026 (versao publica).pdf`, etc.); ligar **a cópia da PUBLICIDADE** em `emendas.documentos_drive`; mover o original para "Já adicionados a plataforma" (subpasta da secretaria). Extrato não leva tarja. Projeto Superação fica parado; o contrato de rateio do Cisum não é o instrumento das emendas 93, 126 e 162 (objeto = custeio do consórcio; a cláusula 12.3 exclui exames e consultas extra cota, pagos por nota fiscal), então não se tarja nem se liga. 19/11: E020 (termo 70) e E176 (termo 71) feitos; extrato do termo 157 (R$ 40.206,83) aguarda o dono indicar a emenda.

## Rolagem sobre os gráficos de Emendas e Pendências (19/11/2026)

O ranking ao lado da pizza (`painel-lista.tsx`, `painel-pendencias.tsx`) tinha `overflow-y-auto overscroll-contain` com altura máxima: o mouse sobre a lista prendia o scroll e a página não andava. Agora **não há rolagem interna**: `LIMITE_LINHAS = 7` linhas e um botão "Ver todos (N)" / "Mostrar menos" (estado `expandida` = aba aberta; abre sozinho se o grupo escolhido estiver além do limite). As linhas além do limite usam `hidden print:list-item` (a impressão sai completa). **Lista nova ao lado de gráfico = sem `overflow-y` com altura fixa**; o scroll do mouse tem que sempre mover a página. Não verificado no navegador (sandbox sem sessão).


## Exportações fiéis aos filtros e PDF executivo com gráficos (23/11/2026)

Relato do dono: um PDF exportado com 41 emendas veio com 20; o filtro "empenhadas sem pagamento" veio com emendas pagas e em licitação; Vereadores e Secretarias não exportavam. **Causas**: (1) a rota `/emendas/exportar` tinha a CÓPIA própria do filtro, que divergia da tela (ignorava `cat`, `p`, `pe`; a busca da tela olhava também unidade e ficha, a da rota não; a ordem nem ia); (2) o Panorama exportava só `s` e `t` e **nunca o cartão `c`** (era o caso do "empenho não pago").
- **Regra**: tela, Excel e PDF usam **a mesma função** (`filtrarEmendasLista` + `ordenarEmendasLista`, `lib/emendas/painel-lista.ts`) e a mesma lista de chaves (`CHAVES_FILTRO_LISTA`, `paramsDeExportacao`). **Filtro novo na lista = uma chave nessa lista**, e passa a valer na exportação. `carregarListaParaExportar` (`exportar-lista.ts`, servidor) aplica o filtro; só calcula pendências quando `p`/`pe` pedem. O Panorama aplica `secretaria`, `tipo` e `cartão` em tudo (gráficos, quadros, lista e Excel).
- **Rastreabilidade**: todo arquivo diz os filtros em palavras (`filtros-texto.ts`) e a contagem ("12 emendas, de 41 no exercício"); o Excel ganhou a aba "Filtros aplicados".
- **PDF executivo** (`pdf-executivo.ts` + `relatorio-executivo.ts`, jsPDF, A4 paisagem, **gráficos vetoriais**): capa com filtros e indicadores, barras, barras empilhadas (pago / empenhado a pagar / sem empenho), rosca, marca de meta (mínimo da Saúde) e tabelas opcionais. Gráfico sem pelo menos 2 grupos não entra; percentuais não somam "Demais"; páginas se preenchem com o gráfico que couber. Entradas: Lista (`formato=executivo`, `tabela=0` só gráficos), Panorama (`formato=pdf`), `/emendas/vereadores/exportar` e `/emendas/secretarias/exportar` (`pdf`, `pdf&tabela=0`, `xlsx`). Builder novo = uma função pura em `relatorio-executivo.ts` (testada em `exportacao.test.ts`); amostra visual: `PDF_AMOSTRA=/pasta npx vitest run exportacao`.
- Só a fonte padrão do PDF (Latin-1, acentos ok). Tabelas do PDF: colunas em R$ têm piso de largura (não quebram "R$ 8.000,0/0").
- **Não feito**: PDF executivo das Pendências e da Conformidade (a Pendências exporta Excel e imprime a tela); gráficos no Excel (ExcelJS não desenha gráficos).

## Permissões de Contratos do Compras pelo Hub (23/11/2026)

Caso real: usuário novo no setor de Contratos (perfil `serv_contratos`) não via contrato nenhum e não havia onde ajustar. **Causa**: no Compras, ver contratos NÃO vem do perfil: `public.pode_ver_contratos()` exige admin, diretor, visualizador **ou** uma linha em `public.permissoes` (`chave = 'contratos_ver'`, `permitido = true`); alterar exige `contratos_editar` (`pode_editar_contratos()`). Contas criadas pelo provisionamento nasciam sem essas linhas (Odomar, Rafaela, Caio e Cíntia tinham, por ajuste manual; Vitor e Carla não). A escrita em `permissoes` só passa na RLS para admin do Compras, e o Hub não tinha tela.
- **Tela**: Configurações → Usuários e acessos → Editar → bloco "Contratos (no Compras)" (`PermissoesContratos`), só para quem tem conta no Compras (`UsuarioComAcessos.contratos`, lido de `public.permissoes` com a chave de serviço). Ação `definirPermissoesContratos` (admin_hub) → `gravarPermissoesDeContratos` (`provisionamento-modulos.ts`; editar implica ver).
- **Padrão novo**: `aprovarCompras` acrescenta `contratos_ver` ao conceder `serv_contratos`/`coord_contratos` (só acrescenta; nunca desfaz o que o admin do Compras decidiu). Edição continua um passo consciente.
- **Dados**: em 23/11/2026 `contratos_ver` foi gravada para Vitor Resende de Morais. Carla Rivone Lopes (também `serv_contratos`, sem permissões) segue sem — decisão do dono.
- **Contratos sem SQL manual (23/11/2026)**: três caminhos no Hub. (1) `DecisaoCompras` ganhou `contratosVer`/`contratosEditar` (opcionais; `FormularioDecisaoModulos` mostra os dois checkboxes, leitura pré-marcada nos perfis serv_/coord_contratos); `aprovarCompras` grava por `gravarPermissoesDeContratos` quando vêm preenchidos e, se ausentes, mantém o padrão (só acrescenta `contratos_ver`). (2) Aviso "Liberar leitura" na linha de Usuários e acessos para perfil de Contratos sem `ver` (`UsuarioComAcessos.contratos.deContratos`, lido de `public.usuarios.perfil`). (3) `liberarLeituraContratosDoSetor` (admin_hub): insere `contratos_ver` para todo serv_/coord_contratos ativo sem NENHUMA linha — respeita quem teve a leitura retirada de propósito (linha `permitido=false`). Nunca remove permissão. Editar contratos segue sendo escolha consciente.
- **Painel de permissões por módulo (23/11/2026)**: `src/lib/permissoes/catalogo.ts` é o catálogo (grupos, itens, dependências como "editar contratos exige ver contratos", modelos); **cada módulo lista só o que o próprio módulo de fato confere** (permissão que nenhum código/RLS lê não entra: interruptor sem efeito engana). Hoje só o Compras (`GRUPOS_COMPRAS`: contratos ver/editar, obras e concorrência, logs — as 4 chaves que o banco do Compras realmente consulta; `distribuir`, `editar_prazo`, `editar_fluxo` e `aprovar_prorrogacao` existem na matriz do Compras mas nada as lê, por isso ficam fora). `PermissoesCompras` (`components/hub/permissoes-compras.tsx`) tem cabeçalho fixo (pessoa + módulo + modelo + Salvar com contagem de mudanças); `definirPermissoesCompras` → `gravarPermissoesCompras` (só admin_hub; liga cria linha, desliga só altera linha existente). **Não há permissão de licitações/compras**: criar exige mudar RLS e telas no repositório App-Compras (fora desta sessão). Emendas/Frotas/Imóveis seguem com perfil + secretaria nas próprias Configurações; entram no catálogo quando houver permissões avulsas.
- **`criar_processos` no painel (23/11/2026)**: primeira permissão avulsa do Compras que vale de ponta a ponta (migration `20261123000000` no repo App-Compras: RPC `criar_processo` + botão em `/processos`). Regra: linha `true` concede, `false` retira o padrão do perfil, sem linha vale o perfil (`permissaoEfetiva`, `padraoPerfis` no catálogo; selo "já vem do perfil"). `gravarPermissoesCompras(usuarioId, definidas)` grava só as chaves alteradas; retirar de quem já tem pelo perfil cria a linha `false`. `editar_prazo` também respeita a linha no banco, mas o botão do Compras ainda depende de ser coordenação, então não entrou no painel.
- **Licitações no painel (23/11/2026)**: grupo `licitacoes` do catálogo com `licitacoes_atuar` (padrão coord/serv de Licitações; `false` retira) e `licitacoes_apos_edital` (só servidor; exige o anterior). Enforcement no repo App-Compras, migration `20261123010000` (ponto único `licitacoes_pode_atuar()`). Ainda sem permissão avulsa: número da licitação por servidor com atribuição ativa e emissão de parecer.
- **`editar_prazo` no painel (23/11/2026)**: agora de ponta a ponta. Banco: `editar_prazo` já respeitava a linha avulsa (coordenação do setor por padrão; concedido a servidor continua limitado às atribuições do PRÓPRIO setor) — testado em transação desfeita (sem concessão barra; com concessão passa no setor próprio e barra em outro). Compras (repo App-Compras): `EditarPrazoAvulso` em `acoes-ciclo.tsx`, mostrado a quem não coordena mas tem a concessão. `distribuir`, parecer e número da licitação por servidor seguem sem permissão avulsa.

## Emendas — novo design (21/11/2026, branch `novo-design-emendas`)

Mockup aprovado em `docs/novo-design-emendas/`. Aplicado a TODAS as abas do módulo sem mudar rota, permissão, RLS ou fluxo; violeta do módulo, estilo Apple (vidro), cabeçalho único da Central e filtro clicável mantidos.
- **Escopo por classe**: o layout põe `emd` na raiz; tudo do novo visual (cantos de 16 px, sombra, movimento, tabelas, `h1` único) vive em `globals.css` sob `.emd`, então Frotas/Imóveis/Compras não mudam. **Tela nova de Emendas herda o visual sozinha**; título = `TituloTela`.
- **Navegação**: `BarraLateral` (≥ `lg`, grupos Acompanhamento/Gestão/Cadastros, mesmos itens do `itens` do layout) e, abaixo de `lg`, a faixa `NavModulo` de sempre. Item novo = uma linha em `itens` (layout) + um ícone/grupo em `barra-lateral.tsx`.
- **Movimento**: `template.tsx` recria a entrada escalonada das seções a cada navegação; barras/anéis "enchem" uma vez (`emd-barra`, `emd-anel-arco`), etapa atual pulsa (`emd-pulso`). Curva única `--emd-curva`; tudo some com `prefers-reduced-motion`.
- **Andamento em %**: `AnelAndamento` (`anel-andamento.tsx`) = `progresso(fases)` (concluídas ÷ aplicáveis). Na lista (coluna Andamento + ordenar por maior/menor %), no detalhe e como "Andamento médio" no painel da lista.
- **Comparação entre anos**: `lib/emendas/comparacao.ts` (puro e testado) + `ComparacaoExercicios`; no Painel escolhe o ano anterior ou `?comparar=AAAA`. Com um exercício só mostra o estado de espera; abrir 2027 liga sozinho. Compara o exercício inteiro e o pago até o mesmo dia de cada ano. **Não testado com dois anos reais** (só dados simulados): conferir quando 2027 abrir.
- Sem foto de vereador (iniciais). Verificado em Chromium (1440 e 390 px, claro e escuro) com dados simulados a partir dos números reais; telas autenticadas reais não testadas (sandbox sem Supabase).
- **Movimento e destaque (21/11/2026)**: `emd-preenche` (barras enchem; **barra nova com `style={{width}}` leva essa classe**), `emd-traco` (linha SVG com `pathLength={1}`), `emd-fatia` (pizza), `emd-conta` (número do anel conta, via `@property --emd-n`), `emd-foco` (lista de ranking: item sob o cursor destaca, vizinhos recuam; o `Pizza` aceita `destaque` para realçar a fatia da linha sob o cursor) e `emd-ergue` (cartão que sobe no hover) — todas em `globals.css` sob `.emd`. Linhas de tabela entram em sequência por CSS (`.emd tbody tr`).
- **Linha clicável**: `LinhaLink` (`linha-link.tsx`, `<tr>` client) abre `href` em qualquer ponto da linha (Ctrl/Cmd e botão do meio = nova aba; links/botões internos e seleção de texto não navegam; prefetch no hover). Usada na lista, no Panorama e na página do vereador. **Tabela de emendas nova = `LinhaLink`**; o link do título continua sendo o caminho do teclado. Um duplo clique para selecionar palavra navega no 1º clique (aceito, para a abertura ser imediata).
- **Alternância Original × Novo: ENCERRADA (22/11/2026).** O botão provisório e todo o visual original foram removidos (`design.ts`, `design-cookie.ts`, `actions-design.ts`, `design-emendas.tsx`, `tabela-emendas.tsx`, o `PainelLista` clássico, o ramo antigo do layout e do `TituloTela`): o visual novo é o único do módulo Emendas, para todos os perfis.
- **Área de trabalho da lista (21/11/2026)**: `/emendas/lista` no visual novo é `AreaTrabalhoEmendas` (`area-trabalho-emendas.tsx`; o original segue `TabelaEmendas`). Três painéis numa grade (`.emd-ws` em `globals.css`): gráficos e filtros (`PainelLista` em modo `compacto`) · lista (cards `role="option"`, ↑/↓ trocam a seleção, Esc fecha) · resumo da emenda (`PainelDetalheEmenda`, usa só o que a lista já tem; `ResumoLinha` ganhou `fases` e `pendencias`). A página não rola: a altura da área é `janela − topo` (calculada em JS), cada painel rola por dentro. Escolher uma emenda grava `?e=<id>` (mesmo `useFiltrosUrl`: some com o filtro lembrado) e a grade anima `grid-template-columns` (gráficos viram faixa de 4,5 rem, lista desliza, resumo abre). Abaixo de `lg` vale o empilhado e tocar numa emenda abre a página dela. A ordenação foi extraída para `lib/emendas/ordenacao-lista.ts` e os chips dos filtros para `chipsDosFiltros` (exportada de `painel-lista.tsx`), ambos usados também pela tabela clássica. **Ideia para as outras abas**: Pendências e Painel podem ganhar o mesmo padrão (gráfico filtra, lista ao lado, detalhe à direita). Não testado com os dados reais (sandbox sem Supabase).
- **Barra recolhível e dois gráficos de filtro (21/11/2026)**: `BarraLateral` ganhou `recolhidaInicial` e botão/tecla `[` (13 rem → 3,75 rem só ícones, com dica e ponto no lugar do selo); a escolha vai num cookie (`emendas_barra`, `definirBarraRecolhida` em `actions-barra.ts`) lido no layout, então a página já abre do jeito certo, sem piscar. O contêiner do visual novo é `max-w-[110rem]` com margens menores. Na área de trabalho da lista, o painel esquerdo é `FaixaIndicadores` (uma linha) + **dois** `GraficoFiltro` (`grafico-filtro.tsx`): cada um escolhe a própria dimensão num seletor, **ignora o próprio filtro mas respeita os do outro**, então os dois se combinam. A lógica de agrupamento saiu de `PainelLista` para a função pura `itensDaVisao` (exportada), usada pelos dois. O cabeçalho da lista é uma linha (título · abas de tipo · exportar/nova). `PainelLista` (modo clássico e `compacto`) continua existindo para o visual original.

- **Resumo da emenda compacto e gráficos proporcionais (21/11/2026)**: `PainelDetalheEmenda` usa container query (`.emd-cont` + `.emd-det-grade`, duas colunas a partir de 32rem do próprio painel: financeiro/pendências/dados à esquerda, fluxo de fases à direita), então se adapta à largura do painel e não da janela; no notebook (1440×800) sobra ~9 px de rolagem interna. Em `GraficoFiltro` cada seção tem `flex-grow` = nº de linhas (mín. 5) + 2 e `min-h-[14.5rem]`, com a rosca (`aspect-square`, máx. 19rem) e as linhas (`flex: 1 0 2.25rem`, máx. 2.75rem) escalando ao espaço; transição `emd-grafico`. Testado em Chromium com dados simulados (1440×800 e 2560×1300); telas muito baixas dependem do mínimo de 14,5 rem por gráfico + rolagem interna. Não testado com o banco real.

- **Painel da emenda com abas e hover do andamento (21/11/2026)**: `PainelDetalheEmenda` (ao lado da lista) tem faixa de abas — Resumo (dados da lista, valor da emenda dentro de "Execução financeira", colunas equilibradas) · Fases · Documentação · Pendências · Financeiro · Andamentos · Parceria · Histórico. As demais abas são o **mesmo `DetalheEmendaCliente` da página da emenda**, em `modoPainel` (sem barra de abas nem moldura; `abaControlada`/`aoMudarAba`/`aoSucesso`), alimentado por `carregarPacoteDetalhe(id)` (`lib/emendas/actions-painel.ts`, só leitura, sob a RLS de quem pede, disparada pelo primeiro clique em aba ou pelo mouse na faixa). A leitura ficou em `lib/emendas/detalhe-completo.ts` (`carregarDetalheCompleto`), **única para a página `/emendas/[id]` e o painel**; depois de gravar, o painel recarrega o pacote e dá `router.refresh()`. Aba "Parceria" = `PainelParceria` + `PainelTransparencia` + vínculo do Compras (na execução direta o vínculo fica em Fases). Aba nova = uma entrada em `abas` do painel (+ caso no `DetalheEmendaCliente` se for do detalhe). `HoverAndamento` (`hover-andamento.tsx`) envolve o anel de % da lista: caixa em portal (cores literais, `rounded-[0.875rem]` para não virar vidro) com valores e "Etapas principais" (`fasesMarcantes`: todas se ≤ 8, senão as marcantes); abre embaixo, ao lado ou em cima conforme o espaço. Verificado em Chromium (1440×800 e 1440×900) com pacote simulado por uma rota temporária (removida); não testado com o banco real.

- **Revisão do painel da emenda e da lista (21/11/2026)**: `lib/emendas/fases-resumo.ts` (puro, testado) consolida as fases do fluxo em **no máximo 6 macro-etapas** por NOME (`macroDaFase`: Planejamento = LOA/análise/exequibilidade; Formalização = processo de compra, plano de trabalho, termo, convênio, extrato… e qualquer fase não reconhecida; Empenho; Pagamento; Prestação de contas; Encerramento) e calcula o `proximoPasso` (fechar empenho se `0 < empenhado < valor`, pagar o que falta, senão a próxima macro-etapa; impedida/cancelada/concluída têm texto próprio). **Fase nova no catálogo = confira em qual macro-etapa o nome cai.** A lista usa `BarraFases` (segmentos verde = feita, cor do módulo = próxima, cinza = a fazer, + "próximo: …") no lugar do anel de %; a caixa de `HoverAndamento` lista as macro-etapas e usa as cores do dinheiro (empenhado azul, pago verde). O painel (`painel-detalhe-emenda.tsx`) tem abas Resumo · Financeiro · Fases · Documentos · Pendências · Mais (Andamentos, Parceria, Histórico), carrega o pacote completo ~350 ms depois de abrir, e **a ação principal da aba fica no topo** (Registrar andamento em Resumo/Fases/Andamentos; Lançar movimento no Financeiro) — os diálogos moram no `DetalheEmendaCliente` (`modoPainel`, sem a barra de botões) e o painel os abre por `controleRef`/`ControleDetalhe.abrir`; "⋯" = Corrigir cadastro (gestor) e Abrir em página inteira. **Remanejar e Registrar impedimento não existem no painel** (decisão do dono: o remanejamento é feito em Configurações, na conferência das planilhas); continuam na página `/emendas/[id]`. Botão Expandir: `data-expandido` no `.emd-ws` (gráficos e lista a 0fr; Esc recolhe). Cores do dinheiro (barra do Resumo): pago #059669, a pagar #D97706, sem empenhar #94A3B8. Gráficos: a lista do ranking centraliza com `mt-auto`/`mb-auto` nos extremos (o `justify-center` cortava o topo ao rolar) e a rosca encolheu (máx. 14,5 rem). Menu suspenso do painel usa `rounded-[0.75rem]` de propósito (`rounded-xl` vira vidro translúcido no estilo Apple). Verificado em Chromium (1440×800) com pacote simulado por rota temporária (removida); não testado com o banco real.

- **Rodada de 22/11/2026 — paleta do dinheiro, folha, atualização imediata e padrão único de área de trabalho.**
  - **Paleta do dinheiro** (`lib/emendas/cores-financeiras.ts`, `COR_DINHEIRO`): indicado cinza-azulado #64748B, empenhado azul #2563EB, pago verde #059669, a pagar âmbar #D97706, sem empenhar #94A3B8, pendência vermelho #B91C1C. Usada na barra do Resumo, na caixa do andamento, no gráfico "Situação financeira" (`COR_FINANCEIRA`: paga = verde, paga em parte = âmbar, empenhada sem pagamento = azul, sem empenho = cinza) e na faixa de indicadores. **Violeta = marca do módulo e seleção, nunca um valor.** As cores das ETAPAS (rosca "Etapa") vêm do catálogo editável `emendas.etapas.cor` (ainda uma rampa violeta): trocar é decisão de dados, não de código.
  - **`EspacoTrabalho`** (`components/emendas/espaco-trabalho.tsx`): esqueleto único (gráficos e filtros | lista | detalhe) com a faixa que recolhe os gráficos, a altura sem rolar a página, Esc (recolhe o expandido, senão fecha) e a **folha abaixo de 1024 px** (CSS em `globals.css`: o detalhe vira `position: fixed` por cima da lista, com fundo opaco `rgb(var(--surface))` — `--surface` é um trio de canais, nunca `var(--surface)` sozinho — e toque no fundo fecha). Usado por `AreaTrabalhoEmendas` (lista), `ListaPendencias` e `AreaTrabalhoPanorama`. **Tela nova de lista = `EspacoTrabalho` + `PainelDetalheEmenda`.** Tocar numa emenda em tela estreita não navega mais: abre a folha.
  - **`PainelDetalheEmenda` por id** (`emendaId`; `emenda`/`resumo` opcionais): sem o que a lista já tem ele espera a leitura completa (`carregarPacoteDetalhe`, que agora devolve também o `resumo` recalculado). `abaInicial` abre numa aba (Pendências → "pendencias", Panorama → "financeiro"). Pendências: `PainelPendencias` é o painel da esquerda (sem moldura própria), a busca/exportar/chips foram para o cabeçalho da lista (`chipsDePendencias`, `removerFiltroPendencia`); selecionar uma pendência abre a emenda. Panorama: `AreaTrabalhoPanorama` (cartões-filtro e selects à esquerda; lista de emendas, quadros por secretaria/vereador/tipo e "Restos anteriores" no meio — clicar numa secretaria ou tipo do quadro filtra; Excel/PDF no `MenuExportar` do cabeçalho da lista); a página do servidor só carrega os dados.
  - **Atualização imediata**: depois de gravar no painel, `aoSucesso` recarrega o pacote e chama `aoAtualizar(id, {emenda, resumo})`; `AreaTrabalhoEmendas` guarda isso por cima das props (`locais`, descartado quando o servidor devolve a lista nova) e a linha, os gráficos e os indicadores mudam na hora; `router.refresh()` roda numa transição, em segundo plano. Pendências e Panorama só fazem o refresh (sem atualização local da linha).
  - Painel: o botão "Registrar andamento" do cartão Próximo passo some quando o do topo é o mesmo; "⋯" só existe para gestor (Corrigir cadastro); sem "Abrir em página inteira" (há Expandir; o botão Expandir some abaixo de 1024 px).
  - Verificado em Chromium (1440×800 e 390×844) com dados simulados por rota temporária (removida); `tsc`/`eslint`/`vitest`/`next build`. **Não testado com o banco real**: conferir no deploy a gravação pelo painel (a linha da lista deve mudar na hora) e as telas de Pendências e Panorama com os dados reais.

- **Rodada de 22/11/2026 (2) — Conformidade, Pendências com 2 gráficos, abas inline e apagar propostas.**
  - **Padrão único de lista** agora em Emendas, Pendências, Panorama e **Conformidade** (`lista-conformidade.tsx`: `GraficoConformidade` com dimensões item exigido/secretaria/tipo/execução, filtros `i`,`s`,`t`,`x`(1 executadas, 0 não),`q`,`e`; detalhe abre em "Parceria", onde se preenche a publicidade do art. 7º). Pendências: `PainelPendencias` = `FaixaPendencias` + dois `GraficoPendencias` (`grafico-pendencias.tsx`, cada um com a sua dimensão, ignoram o próprio filtro e respeitam o do outro).
  - **Painel da emenda**: as 8 abas ficam todas na faixa (Resumo, Financeiro, Fases, Documentos, Pendências, Andamentos, Parceria, Histórico); sem "Mais" e sem "⋯"; "Corrigir cadastro" (gestor) no cabeçalho.
  - **Macro-etapas** (`fases-resumo.ts`): `Repasse`/`Repasse à conta específica` entram em **Pagamento** (antes caíam em Formalização e o Pagamento sumia nos fluxos de parceria); `Execução e monitoramento` entra em **Execução e prestação** (a macro `prestacao` foi renomeada). Achado com a emenda 1 (ente, paga em 26/03/2026, extrato publicado em 29/03): a fase Repasse está concluída, o que estava pendente era "Execução e monitoramento" (manual) e a pendência real é **Datas fora de ordem (Repasse antes do extrato)**, correta pela Lei 13.019, art. 38. **Decisão do Controle Interno (22/11/2026): a saída é a publicação de um extrato saneador**; hoje isso se registra na **justificativa** da pendência (o texto da pendência já cita a saída). Ainda NÃO existe campo/tipo de documento "extrato saneador" que baixe a pendência sozinho: se o dono quiser, é uma coluna em `execucao` (data do extrato saneador) + regra em `datasForaDeOrdem` + tipo novo em `documentos_drive`.
  - **Aprovações — apagar** (`apagarPropostas` em `actions-propostas.ts`, só gestor; migration `20261122000000_emendas_apagar_propostas.sql`, **já aplicada** em produção: `grant delete` + policy `gestor_apaga_propostas`). Antes só havia aprovar/rejeitar e proposta em **conflito** não tinha botão nenhum. Agora: "Apagar" por proposta, "Apagar marcadas" (marcar vale para todas as da lista, inclusive conflito) e "Apagar todas as decididas". Apagar não altera a emenda.
  - Verificado em Chromium (1440×800) com dados simulados por rota temporária (removida); não testado com o banco real (nem a exclusão de propostas pela tela).

- **Caixa de informações e "voltar ao topo" (22/11/2026).** `CaixaInfo` (`components/emendas/caixa-info.tsx`) é o cartão claro que abre ao passar o mouse (ou focar), com **pausa de 1 s** de mouse parado (350 ms ao passar de um alvo para o vizinho logo depois; alterado em 22/11/2026, antes 480/140 ms; fecha ao sair, clicar, rolar, redimensionar ou Esc). Vai em portal para o `body` (cores literais; `rounded-[0.875rem]` para não virar vidro). Conteúdo com `CaixaTitulo` (rótulo, valor, número de apoio), `CaixaLinhas` (rótulo … valor, bolinha de cor, apoio) e `CaixaNota`. `as` = `span` | `div` | `li` e `style`/`className` passam para o alvo (células de grade e itens de lista). **Regra: dado consolidado (indicador, barra, fatia/linha de gráfico, fase) abre `CaixaInfo`, não `title=`** (o tooltip nativo é pequeno e escuro). Aplicado em: `FaixaIndicadores` e linhas de `GraficoFiltro`, `FaixaPendencias`/`GraficoPendencias`, `ListaConformidade`, cartões do Panorama, `Kpi` (prop `info`) e linhas por vereador do Painel, fases e barra financeira do Resumo do painel da emenda, `Marca` (aba Fases) e `LinhaEtapas`. `HoverAndamento` virou um uso de `CaixaInfo`. Ainda com `title` nativo, de propósito (texto curto, não dado consolidado): selos de tipo/pendência, botões. `VoltarAoTopo` (`voltar-ao-topo.tsx`): botão discreto no canto da lista, aparece depois de 480 px de rolagem; usado em Emendas, Pendências, Conformidade e Panorama (contêiner `relative` em volta da lista + `alvoRef`). Verificado em Chromium com dados simulados (passagem rápida do mouse = nenhuma caixa; mouse parado = abre). Não testado com o banco real.

- **Telas enxutas e gráficos adaptáveis (22/11/2026).** Regra do dono: sem frase explicativa embaixo do título nas telas de Emendas (linha de dado, como "Exercício 2026", pode ficar); a **Conformidade** é a exceção porque cita lei e ajuda: base legal na linha do título + "Como usar" em `<details>` curto. O painel esquerdo do `EspacoTrabalho` passou a `overflow-y-auto` e os gráficos a `min-h-[13rem]`: em tela baixa o painel rola por dentro em vez de cortar o segundo gráfico.

- **Rolagem suave e encaixada (22/11/2026).** `globals.css` (`.emd-rola`, `.emd-lista`, `.emd-foco`): `scroll-behavior: smooth` e, nas listas (`.emd-lista`, filhos diretos), `scroll-snap-type: y mandatory` com `scroll-snap-align: start` (o topo nunca fica com linha cortada; gráficos usam `proximity`). `prefers-reduced-motion` volta ao normal. **Área nova que rola em Emendas = classe `emd-rola` (área) ou `emd-lista` (lista de itens).**

- **Fluidez da navegação (22/11/2026).** Medido em Chromium (lista de 215 linhas, quadros por `requestAnimationFrame`): abrir/fechar/trocar o detalhe tinha 6–26 quadros acima de 50 ms (p95 56–93 ms); depois, 0–2 (p95 ≈ 17–20 ms). Causas e correções: (1) a transição de `grid-template-columns` refazia o **desfoque de vidro** (`backdrop-filter`) de todos os painéis a cada quadro → `EspacoTrabalho` marca `data-movendo` durante a transição (0,4 s) e o CSS desliga o desfoque e as animações internas só nesse intervalo; cartões **dentro** dos painéis não têm desfoque (só os painéis); (2) a lista inteira era medida/pintada → `content-visibility: auto` em `.emd-lista > *`; (3) escolher uma emenda re-renderizava as ~215 linhas e refazia gráficos/ordenação → `LinhaEmenda` em `React.memo` e filtros com identidade estável (`JSON.stringify`/`parse`, o React Compiler guarda os cálculos; **não usar `useMemo` manual nessas telas: o lint `preserve-manual-memoization` recusa**); (4) animações de entrada mais curtas (página 0,22 s, linhas 0,22 s com escalonamento até 60 ms). Tela nova com grade deslizante = `EspacoTrabalho`; lista longa = `.emd-lista` + linha memoizada.

- **Limpar filtros e encaixe leve (22/11/2026).** `EspacoTrabalho` ganhou `aoLimpar` (botão discreto no alto da área de gráficos, apagado sem filtros; usado por Emendas, Pendências, Conformidade e Panorama). O encaixe da lista passou de `mandatory` a `proximity` (o `mandatory` "puxava" a cada giro da roda = trancos) e o `content-visibility` das linhas foi **retirado** (altura estimada diferente da real fazia a rolagem saltar); o ganho de fluidez vem do desfoque desligado durante o deslize e das linhas memoizadas.

- **Estados de tela e rolagem com desaceleração (22/11/2026).** Mockup aprovado aplicado em `components/emendas/estados-tela.tsx` (`CartaoEstado`, `TelaErro`, `TelaNaoEncontrada`, `AvisoConexao`, `CarregandoLento`) + `app/emendas/error.tsx` e `not-found.tsx`; `loading.tsx` das 4 rotas de lista levam `CarregandoLento` (linha fina no alto, âmbar e aviso aos 3 s, decisão aos 10 s). `AvisoConexao` fica no layout (usa `lib/use-online.ts`; "Tentar de novo" faz uma chamada HEAD e recarrega). O erro mostra `ERR-<digest>`; o texto da exceção só em desenvolvimento. **Offline com tela cheia só aparece quando a navegação falha e cai no `error.tsx`** (não há service worker): o aviso no topo cobre a conexão que cai com a tela aberta; as gravações NÃO são desativadas (só avisadas). Rolagem: `scroll-snap` removido (dava tranco); `AjusteDeRolagem` (layout de Emendas) espera 140 ms sem rolar e anima `scrollTop` até o início da linha mais próxima (easeOutCubic, 200–420 ms), cancelado por roda/toque/tecla/clique, sem ajuste com `prefers-reduced-motion`. Funciona em `.emd-lista` (listas de itens). A lista tem `padding-bottom` e degradê (`mask-image`) na borda de baixo, e o painel de detalhe também. Testado em Chromium: após a roda, a rolagem desacelera (-5, -4, -3… px/quadro) e termina com a linha no topo.

- **Ação principal do painel da emenda no cabeçalho (22/11/2026).** `Registrar andamento`/`Lançar movimento` saíram da faixa de abas (em notebook caíam para uma linha própria) e viraram o botão compacto `CLASSE_BOTAO_ACAO` ("+ Andamento"/"+ Movimento", `title`/`aria-label` com o nome completo) no canto direito do cabeçalho de `PainelDetalheEmenda`, antes de Corrigir cadastro/Expandir/Fechar. A faixa de abas ficou só com as abas.

- **Caixa de informações: 1 s e no título (22/11/2026).** `ATRASO_PADRAO` = 1500 ms (era 1000) (vizinho 350 ms). O título da emenda abre caixa: na lista, o link do objeto vem envolvido por `HoverAndamento` (ganhou `as`/`className`), e no painel da emenda o `<h2>` abre uma `CaixaInfo` com objeto completo, beneficiário, secretaria e vereador (no lugar do `title=` nativo).

- **Painel de abertura do módulo (22/11/2026).** `/emendas` virou uma tela de comando (mockup aprovado: artifact "Painel das Emendas — Proposta"). Regra pura em `lib/emendas/painel-abertura.ts` (`montarPainel`, testada: partição pago/empenhado a pagar/sem empenhar, situação financeira com as MESMAS classes do filtro `fin` da lista, lista de atenção só com o que tem quantidade, ritmo semanal necessário e média das últimas 8 semanas, funil pela primeira macro-etapa não concluída, vereadores, Saúde, secretarias, últimos lançamentos e prazos) e desenho em `components/emendas/painel-abertura.tsx` (cliente, por causa de `CaixaInfo` e da ordenação dos vereadores). `app/emendas/page.tsx` só carrega: emendas, movimentos, cálculos (conformidade e pendências), execuções (vigência), Panorama (restos sem situação), propostas pendentes e o alerta de "paradas" (`alertas()` de `regras.ts`, 30 dias). **Item novo em "Precisa da sua atenção" = um `add(...)` em `montarPainel` + a contagem em `contagens`.** Cada item e cada número do hero levam a uma tela já filtrada (`/emendas/lista?fin=…`, `/emendas/pendencias?g=alta`, `/emendas/conformidade?x=1`, `/emendas/panorama?c=sem_situacao`…). "Publicar" (portal) só aparece para o admin da Central e só se o exercício não está publicado. O hero é um cartão escuro fixo (cores literais, igual ao cabeçalho); `mt-auto` na régua e `flex-1` nas listas dos cartões vizinhos evitam sobra em branco sob o card maior. Saíram `painel-emendas.tsx` (filtros + KPIs + gráficos antigos), `faixa-tipos.tsx` e o `CartaoPanorama`; o tour `emendas-painel` ganhou os passos "Execução do exercício" e "O que precisa da sua atenção" (`data-tour="indicadores-emendas"`/`"atencao-emendas"`). Atividade recente = só lançamentos financeiros (empenho, pagamento, anulação), com "hoje/ontem/há N dias" (o banco guarda a data do lançamento, não a hora). Verificado em Chromium (1440 e 390 px, claro e escuro) com 215 emendas simuladas por rota temporária (removida); **não testado com o banco real**: conferir no deploy se os números batem com a lista e o Panorama.

- **Confirmações e avisos em cartão central (22/11/2026).** `components/ui/dialogos.tsx` (`ProvedorDialogos` no layout raiz + `useDialogos()` → `confirmar`, `pedirTexto`, `avisar`; todos devolvem Promise) substitui `window.confirm/prompt/alert` na plataforma inteira: cartão no centro, fundo escurecido, Esc/clique no fundo cancelam, foco em "Cancelar" nas ações perigosas, Tab preso no cartão, foco volta ao botão de origem; o cartão herda `--modulo*` do elemento que o abriu (o portal fica fora do contêiner da cor). `pedirTexto` tem `minimo` (contagem de caracteres), `igualA` (digitar o número da emenda) e `multilinha`. **Nunca usar `window.confirm/prompt/alert` em código novo** (nem `confirm(` solto): `const { confirmar } = useDialogos(); if (!(await confirmar({ titulo, mensagem, rotuloConfirmar, tom: "perigo" }))) return;` — o handler precisa ser `async`. Fluxo de fases do Resumo da emenda: uma linha só (`repeat(N, minmax(0,1fr))`), nomes curtos (`NOME_CURTO_MACRO`, "Execução e prestação" vira "Execução"; o nome completo fica na caixa); `FaseLinha.alertas` leva o texto do problema (`ResumoLinha.fases[].alertas`) e `alertasDaMacro` o mostra na caixa da etapa (Resumo) e na caixa da lista (`HoverAndamento`) sob "Atenção".

## Frotas e Imóveis no visual do Emendas — Etapa 1 (22/11/2026, branch `novo-design-emendas`)

Pedido do dono: aplicar a Frotas e Imóveis o sistema de design do Emendas, em 3 etapas aprovadas (1 base visual comum · 2 painel de abertura de cada módulo · 3 áreas de trabalho nas listas, com resumo ao lado só para consulta e edição em página própria; também Água, Luz e Vencimentos, num layout mais simples). Barra lateral recolhível nos dois módulos.
- **Escopo `.emd`**: os layouts de `/frotas` e `/imoveis` agora levam a classe `emd` (cartões de 16 px, sombra, entrada escalonada via `template.tsx` com `.emd-pagina`, tabelas e `h1` do Emendas). **Tela nova de qualquer um dos 3 módulos herda o visual sozinha.**
- **Componentes compartilhados movidos para `components/modulo/`** (os imports antigos de `components/emendas/…` foram trocados): `barra-lateral.tsx`, `estados-tela.tsx`, `ajuste-de-rolagem.tsx`, `caixa-info.tsx`, `titulo-tela.tsx`. `BarraLateral` recebe `modulo` (`emendas`/`frotas`/`imoveis`), `grupos` (`{titulo, itens[{href, rotulo, icone, selo}]}`; `icone` é um NOME do registro `ICONES` dentro do arquivo, porque o servidor não manda componentes ao cliente) e `atalhoExterno` opcional; a preferência "recolhida" vai por cookie por módulo (`lib/modulo/barra-cookie.ts`, `COOKIES_BARRA`; o do Emendas mantém `emendas_barra`) e `definirBarraRecolhida(modulo, bool)` está em `lib/modulo/actions-barra.ts`. **Item novo no menu = uma linha em `itens` do layout + o href em `GRUPOS_<MODULO>` + um ícone em `ICONE_<MODULO>` (e, se for novo, um nome em `ICONES`).**
- **Estados de tela** genéricos: `TelaErro` (`voltar`, `dica`), `TelaNaoEncontrada` (`principal`, `secundario`, `objeto`), `AvisoConexao`, `CarregandoLento`; cada módulo tem `error.tsx`, `not-found.tsx`, `loading.tsx` (com `CarregandoLento`) e `template.tsx`. O layout de cada módulo monta `AjusteDeRolagem` e `AvisoConexao` dentro do `<main>`.
- **Títulos**: `TituloPagina` (`components/modulo/ui.tsx`) tem a tipografia do `TituloTela`; subtítulo só com dado curto (período, contagem). Saíram as frases explicativas de Frotas e Imóveis (as páginas de importação ficaram só com o link "← Voltar…"). O limite dos alertas do painel de Frotas ("amarelo a partir de N dias…") saiu do subtítulo e volta como legenda no painel novo (Etapa 2).
- Verificado em Chromium (1440 e 390 px, claro e escuro) com o shell reproduzido numa rota temporária (removida); **telas autenticadas reais não testadas** (sandbox sem Supabase).

## Frotas e Imóveis — Etapa 2: painéis de abertura (22/11/2026)

Proposta aprovada pelo dono (artifact "Painéis de Frotas e Imóveis") com a regra extra: **sem espaços vazios entre os cartões**. Mesmo desenho do Painel das Emendas.
- **Peças comuns** em `components/modulo/painel-abertura-ui.tsx`: `CabecalhoPainel` (saudação + `acao`), `Hero` (cartão escuro: valor grande, barra segmentada com caixa de informação, 4 cartões-legenda, chips, insight, rodapé; brilho na cor do módulo via `--modulo`), `ListaAtencao`, `ListaEtapas` (`numerada`), `ListaBarras` (barra simples, empilhada ou com marcas de limite), `GraficoMeses` (colunas em HTML, não SVG: preenche a altura do cartão sem distorcer texto; animação `emd-sobe` em `globals.css`), `ListaMovimentos`, `Anel`. `lib/moeda.ts` (`brlCurto`, `brlCompleto`, `pctDe`) é a fonte do formatador (o de Emendas reexporta).
- **Como não sobra buraco**: as linhas de lista são `flex-1` (esticam até a altura do cartão vizinho), os cartões de uma linha da grade esticam juntos, o gráfico mensal é `flex-1`, e o que é opcional (insight, nota) fica sob um `mt-auto`. Conferido em Chromium (1440, 1280, 1024, 390 px, claro e escuro): folga abaixo do último elemento de cada cartão de 0–1 px. **Cartão novo de painel = `flex flex-col` + lista `flex-1`; nunca altura fixa.**
- **Frotas** (`lib/frotas/painel-abertura.ts`, puro e testado; `components/frotas/painel-abertura.tsx`): `montarPainelFrotas` reaproveita `calcularPainel`/`calcularAlertas`/`custoPorVeiculo`. Dinheiro em aberto = manutenções de orçamento a analisar até NF registrada (recusadas e "novo orçamento" ficam fora); tempo médio = dias desde a entrada na etapa atual (manutenções abertas + NFs não entregues à Contabilidade). "Últimos movimentos" vem das DATAS gravadas em cada registro (não há tabela de histórico; o banco guarda a data, não a hora). A legenda dos limites dos alertas (`dias_atencao`, `dias_critico`, `pct_atencao`, `pct_critico`) voltou ao rodapé do cartão escuro. **Alerta novo = um `add(...)` em `montarPainelFrotas`.**
- **Imóveis** (`lib/imoveis/painel-abertura.ts`, puro e testado; `components/imoveis/painel-abertura.tsx`): mês de referência = conta mais recente sem passar do mês corrente; comparação com a média dos 3 meses anteriores (`comparar`, exige 3 meses de histórico); "atenção" agrupa as pendências por assunto (consumo, ligação ativa, contratos, entregas…); "contas fora do padrão" repete a análise de `calcularPendencias` mas só mostra as que ainda são pendência (justificadas somem); o aluguel dos 12 meses usa o valor atual dos contratos (aproximação já existente em `totaisMensais`). Insight de secretarias com luz alta usa `pct_acima / 2` (a soma de várias unidades varia menos que uma conta isolada). **Todos os limites vêm de `imoveis.parametros`.**
- Painéis das listas, Água/Luz/Vencimentos e as áreas de trabalho com resumo ao lado ficam para a Etapa 3. O tour de Frotas (`frotas-painel`) aponta para o cartão escuro (`resumo-frotas`) e a quinzena (`quinzena-frotas`); Imóveis ainda não tem tour.
- Verificado com dados simulados numa rota temporária (removida): `tsc`/`eslint`/`vitest`/`next build`. **Não testado com o banco real** (sandbox sem Supabase): conferir no deploy se os números do painel batem com as listas e com a tela de Pendências.

## Frotas e Imóveis — Etapa 3: áreas de trabalho nas listas (22/11/2026)

- **Kit genérico** (`components/modulo/`): `AreaTrabalhoLista<T>` (a mesma área de trabalho do Emendas: gráficos que filtram | lista | resumo), `GraficoDimensao` (pizza + ranking de uma "dimensão" escolhida num seletor; ignora o próprio filtro e respeita os dos outros), `resumo-ui.tsx` (`Bloco`, `Campos`, `Numeros`, `Passos`) e, movidos de `components/emendas/`, `EspacoTrabalho`, `Pizza` e `VoltarAoTopo`. A regra de filtro é pura e testada em `lib/modulo/area-trabalho.ts`: `Dimensao<T>` = parâmetro da URL + função que diz a que opção(ões) o item pertence, com `aliases` (valor de URL que vale por várias opções, ex. `sit=andamento`) e `padrao` (vale quando o parâmetro está vazio e NÃO conta como filtro ativo). **Os parâmetros são os mesmos dos links antigos** (`sit`, `sec`, `vinc`, `quinz`, `rev`, `alerta`, `g`, `s`, `j`…), então painéis, sino e favoritos continuam levando à lista filtrada.
- **Tela nova de lista = uma função `montarLinhasX` pura e testada** (`lib/frotas/area-trabalho.ts`, `lib/imoveis/area-trabalho.ts`: o servidor calcula tudo o que a linha e o resumo mostram, em objetos simples que atravessam para o navegador) **+ um componente cliente com `dims`, `ordens`, `renderLinha` e `renderResumo`** (`components/frotas/areas-trabalho.tsx`, `components/imoveis/areas-trabalho.tsx`; funções de módulo, de identidade estável, porque a linha é memoizada) **+ a página só carregando dados**. Funções não atravessam do servidor para o cliente: por isso o componente de cada tela é cliente.
- **Resumo ao lado é só consulta; edição fica na página própria** (decisão do dono). Onde já havia formulário na própria rota (`/frotas/manutencao?id=`, `/frotas/combustivel?editar=`/`?novo=1`, `/frotas/veiculos?editar=`/`?novo=1`), a página mostra o formulário (agora sozinho, com "← Voltar à lista") quando esses parâmetros existem e a área de trabalho quando não. Quem não é gestor não vê o botão "Abrir e editar" em Combustível e Veículos (`hrefPagina` devolve `null`). Em Pendências o botão Justificar fica no resumo (é a ação da tela).
- **Telas**: Frotas — Manutenção (etapa com `sit=andamento` por padrão, secretaria, alerta de prazo, oficina, conferência da NF `div=nf_acima`), Veículos (vínculo, secretaria, situação, cadastro `rev`, valor de referência, combustível), Combustível (situação com `sit=ativas` por padrão: esconde as NFs na Contabilidade há mais de 30 dias — chave `arquivada`; secretaria, quinzena, alerta, posto). Imóveis — Imóveis (situação, vínculo, secretaria, contrato, pendência), Pendências (gravidade, assunto, secretaria, situação com `j` padrão "em aberto" e `j=1` mostrando as justificadas, imóvel), Entregas (situação, próxima etapa, alerta, secretaria). **Água, Luz e Vencimentos** ficaram sem painel lateral (decisão do dono): faixa de indicadores, `GraficoMeses` e tabela com cabeçalho fixo e rolagem própria; Vencimentos com as linhas esticando até a altura do cartão vizinho.
- **Exportar** leva à exportação os filtros que o servidor entende (`q`, `sec`, `quinz`, `vinc`, `rev` e o `sit` antigo, traduzido); filtros novos (alerta, oficina, gráficos) só valem na tela.
- **Achado de carona**: os campos de seleção das áreas de trabalho usavam `bg-white/80`, que o modo escuro não remapeia (texto claro sobre fundo claro); passaram a `rounded-[0.75rem] … bg-white` (sólido e remapeado), nos módulos Emendas, Frotas e Imóveis. Campo novo = `bg-white` com raio arbitrário, nunca `bg-white/NN` nem `rounded-xl` (vira vidro).
- Verificado em Chromium (1440 e 390 px, claro e escuro) com dados simulados numa rota temporária (removida): seleção abre o resumo, clique em fatia/linha filtra e grava a URL, folha no celular sem rolagem horizontal, sem erros de console. **Não testado com o banco real**: conferir no deploy se os números da lista batem com os painéis e se "Abrir e editar" leva ao formulário certo.

## Frotas e Imóveis — velocidade e resposta ao clique (22/11/2026)

Pedido do dono: revisar os dois módulos e aplicar tudo o que melhore a velocidade de navegação, a resposta ao clique e a UX. Medido por leitura do código (o sandbox não alcança o banco): o que atrasava era trabalho repetido no servidor, não o desenho das telas.
- **Cache curto entre requisições** (`lib/modulo/cache-dados.ts`, `lerComCacheModulo(modulo, nome, escopo, ler)`; mesmo desenho do `lerComCache` de Emendas): `unstable_cache` de 60 s, chave = módulo + leitura + **id da pessoa**, e a leitura que preenche o cache roda com o **token da própria pessoa** (`clienteFixoModulo`; `criarClienteFrotas`/`criarClienteImoveis` o usam quando existe), então a RLS continua decidindo o que entra (a secretaria só guarda o que enxerga). Aplicado a todas as `listar*`/`obterParametros` de `lib/frotas/dados.ts` e `lib/imoveis/dados.ts`. **Gravação nova = importar `revalidarCaminho as revalidatePath` de `lib/frotas/invalidar.ts` ou `lib/imoveis/invalidar.ts`** (expira a tag `frotas-dados`/`imoveis-dados` e revalida o caminho; só em Server Action). Mudança por fora do app (SQL direto) leva até 60 s. Cada entrada tem limite de 2 MB do cache do Next (a maior é `contas`, ~2.600 linhas; se passar, a leitura cai para direta, sem erro).
- **Tabela grande em paralelo** (`lib/modulo/ler-todas.ts`, testada): a 1ª página já traz o total (`count: "exact"`) e as outras saem juntas — sempre 2 idas, antes 1 por página em série. Quem lê tabela inteira usa `lerTodas((de, ate, o) => …select("*", o)…)`.
- **Layouts**: o selo do menu de Frotas é só a contagem (`contarOrcamentosAAnalisar`, `select … head`), não a tabela de manutenções; o selo e as colunas da exportação começam junto com o contexto, não depois dele. O de Imóveis usa as mesmas leituras (já em cache) das telas. `lerColunasOcultasDoUsuario` usa `getClaims()` (local) em vez de `getUser()` (ida ao servidor de Auth em toda página).
- **Sem `router.refresh()` depois de Server Action que já revalida** (20 chamadas removidas em componentes de Frotas e Imóveis): a resposta da ação já traz a tela nova; o refresh extra refazia layout e página inteiros. Ação nova com escrita deve chamar `revalidarCaminho` e o componente **não** chama `router.refresh()`.
- **Clique respondido na hora**: `MarcaPendente` (`components/modulo/marca-pendente.tsx`, `useLinkStatus`) dentro dos links da `BarraLateral` e da `NavModulo`; enquanto a navegação não termina o item acende como o ativo e mostra um ponto pulsando (CSS `a:has([data-pendente])` em `globals.css`, escopo `.emd`). **Link novo de menu = pôr `<MarcaPendente />` dentro dele.** `loading.tsx` com `EsqueletoLista` nas 6 listas (Manutenção, Combustível, Veículos, Imóveis, Pendências, Entregas) e `EsqueletoPagina` no detalhe/novo/importar, para o esqueleto parecer a tela que vem.
- Verificado: `tsc`/`eslint`/`vitest` (507)/`next build`. **Não medido em produção nem testado com o banco real** (sandbox sem acesso): conferir no deploy que a 2ª aba abre mais rápido, que gravar atualiza na hora e que uma secretaria só vê os imóveis dela (cache por pessoa).

## Requerimentos no padrão de design dos módulos (22/11/2026; repositório `app-requerimentos-camara`, branch `novo-design-requerimentos`)

Pedido do dono: aplicar o padrão aos Requerimentos (controle de distribuição e prazos às secretarias), com os prazos fáceis de ver e **sem gráficos que não sejam relevantes**. O app é outro repositório, então o kit foi **copiado** (não há pacote compartilhado): `components/modulo/{area-trabalho-lista,grafico-dimensao,espaco-trabalho,pizza,caixa-info,estados-tela,ajuste-de-rolagem,voltar-ao-topo,use-filtros-url,ui}.tsx`, `lib/modulo/area-trabalho.ts`, `lib/moeda.ts`, `lib/use-online.ts` e o bloco `.emd` do `globals.css` (do Hub, linhas "Emendas — novo design" em diante). **Mudou o kit aqui? Repetir lá (e vice-versa).**
- **Tela** (`/dashboard`, `components/requerimentos/area-requerimentos.tsx`): `AreaTrabalhoLista` com os gráficos **Prazo** (atrasados · até 3 dias · 4–7 · 8–15 · mais de 15; só os abertos entram, para o histórico devolvido não dominar o gráfico) e **Resposta pendente de** (secretaria que ainda deve), mais Situação, Secretaria e Vereador como opções do seletor. Regras puras e testadas em `lib/requerimentos/area-trabalho.ts` (`montarLinhas` no servidor, `dimensoesRequerimentos`, `ORDENS_REQUERIMENTOS` — padrão "mais urgentes primeiro" —, `indicadoresRequerimentos`: atrasados, vencem em 7 dias, a distribuir, prontos para devolver). As faixas são fixas (3/7/15 dias); a barra de prazo do detalhe continua usando os limiares configurados em Configurações → Prazo. Parâmetros da URL: `prazo`, `pend`, `fase`, `sec`, `ver`, `q`, `ordem`, `e` (requerimento aberto; o antigo `?req=` redireciona para `?e=`).
- **Detalhe ao lado com as ações** (diferente de Frotas/Imóveis, onde o resumo é só consulta): o fluxo do Gabinete e das secretarias (distribuir, ciência, responder com anexo, prorrogar, enviar à Câmara, anular) é o trabalho da tela, então `DetalheRequerimento` (`acoes-requerimento.tsx`, o antigo painel sem a tabela) vive no painel, com `key={id}` para o estado dos formulários não vazar entre requerimentos. A exportação (`ModalExportar`) leva a lista como está na tela.
- **Não foi criada** barra lateral (só há Início e Configurações, já no cabeçalho) nem painel de abertura separado (o próprio Início já é o painel de prazos).
- **Correções no kit, valem para os três módulos do Hub**: (1) `.emd .emd-pagina > * > *` usava `animation … both`, que deixava `transform: matrix(1,0,0,1,0,0)` no contêiner da área de trabalho; como transform vira o bloco de contenção de `position: fixed`, a folha do detalhe no celular ficava com 1160 px de altura e saía da tela. Agora é `backwards`. (2) Os números do alto (`kpis`) ficam em 2 colunas no celular (antes 4 colunas com rótulo cortado).
- Verificado em Chromium (1440 e 390 px, claro e escuro) com 34 requerimentos simulados (rota temporária, removida), sem erros nem rolagem horizontal; `tsc`/`eslint`/`vitest`/`next build` nos dois repositórios. **Não testado com o banco real.**


## Boas-vindas ao novo design, tutoriais e velocidade (24/11/2026, branch `design-paridade-boasvindas`)

- **Auditoria de paridade com o Emendas (referência)**: kit `components/modulo/*` e o bloco `.emd` do `globals.css` conferidos por `diff` entre Hub, Compras e Requerimentos: iguais (só mudam ícones de menu, caminho do `MarcaPendente` e o `grid-cols-1` exigido pelo teste de grades). Frotas e Imóveis têm layout idêntico ao do Emendas (cabeçalho `CabecalhoHub`, `NavModulo` < `lg`, `BarraLateral` ≥ `lg`, `AjusteDeRolagem`, `AvisoConexao`, `max-w-[110rem]`). Diferenças que ficam de propósito: seletor de exercício e portal só no Emendas; Requerimentos não tem barra lateral (só Início e Configurações). Lacuna achada e corrigida: o Compras não tinha `error.tsx`/`not-found.tsx` dentro do shell nem `CarregandoLento` no `loading.tsx` — agora tem (kit `TelaErro`/`TelaNaoEncontrada`).
- **Tela de boas-vindas** (`components/ajuda/boas-vindas-design.tsx`, cópia nos 3 repositórios): 5 passos num cartão central (novo visual/menu, gráficos que filtram, lista + detalhe, caixas de informação, ajustes de zoom/tema), uma única vez por pessoa. O "visto" fica em `hub.preferencias_usuario.boas_vindas_design_em` (migration `20261123000000`, **já aplicada**; RPC `hub.marcar_boas_vindas_design`, sem EXECUTE para `anon`), então vale em qualquer navegador e nos três apps (a primeira tela que a pessoa abrir mostra; as outras não repetem); o navegador guarda uma cópia (`boas-vindas-novo-design-2026-11`) para não repetir se a rede falhar. Montada em `CabecalhoHub` (Hub e módulos internos) e nos layouts protegidos do Compras e dos Requerimentos; lê o visto junto das preferências de aparência (`lerPreferencias().boasVindasVistas`). Fecha com Esc, "Pular" ou ✕ (todos contam como visto); o tour de boas-vindas do Hub/Compras espera ela fechar (evento `boas-vindas-design-fechada`). **Numera não tem a tela** (app estático à parte). Para mostrar de novo a todos no futuro: trocar a chave/versão e a coluna (ou criar nova coluna).
- **Tutoriais**: Hub — tour genérico `area-trabalho` (gráficos que filtram, lista, resumo ao lado; vale em Emendas, Frotas e Imóveis via `rotasExtras`, âncoras `data-tour="ws-graficos|ws-lista|ws-detalhe"` no `EspacoTrabalho`) e `imoveis-painel`; Compras — `inicio` e `contratos` novos, boas-vindas atualizado (menu recolhível, tema). `executarTour` pula passo cujo elemento está recolhido (painel fechado). **Tela nova de lista = `EspacoTrabalho` (já tem as âncoras); rota nova no tour = uma entrada em `rotasExtras`.**
- **Velocidade**: `getClaims()` em `obterUsuarioAtual` do Compras (o middleware já validou com `getUser()`; poupa uma ida ao Auth por navegação; Hub e Requerimentos já faziam); `loginDiretoBloqueado` do Compras em cache de 60 s; `preconnect` ao Supabase nos três layouts raiz e aos apps externos na Início do Hub (clique no card encontra a conexão pronta). Já existentes e mantidos: cache curto por pessoa (Emendas, Frotas, Imóveis), `staleTimes.dynamic` de 45 s no Hub, esqueletos de carregamento. **No Compras o cache de rotas dinâmicas segue desligado** (um processo recém-criado só aparecia após F5).
- Verificado: `tsc`/`eslint`/`vitest`/`next build` limpos; modal conferido em Chromium (1440 e 390 px, claro e escuro; abre uma vez, Esc fecha, recarregar não reabre) numa rota temporária (removida). **Não testado com sessão real** (sandbox sem Supabase): conferir no deploy que o "visto" grava e que o segundo acesso não mostra.

- **Gráficos sem barra de rolagem externa (24/11/2026).** A área de gráficos do `EspacoTrabalho` não rola mais: o contêiner é `overflow-hidden` e cada gráfico (`min-h-0 overflow-hidden`, altura proporcional ao nº de linhas) se ajusta à altura da tela; a rosca encolhe até `min-h-[4.5rem]`. Quem rola é só a lista de cada gráfico (`.emd-foco`), e a barra fina dela só aparece com o mouse (ou o foco) em cima (`scrollbar-width: thin` + `scrollbar-color` transparente → visível no hover, `globals.css`). Medido em Chromium (1440×900, 1366×680, 1920×1080): conteúdo do painel = área visível (sem rolagem externa). Mesma mudança nos kits do Compras e dos Requerimentos (`grafico-dimensao`, `espaco-trabalho`, `globals.css`).

- **Painel da emenda, botões e selo "Paga" (24/11/2026).** (1) **Altura da área de trabalho** (`EspacoTrabalho`): deixou de usar "janela − topo − 28 px" medido uma vez; agora mede o que existe DEPOIS da área (preenchimentos/margens dos contêineres e irmãos estáticos) e reajusta com `ResizeObserver`, fontes e janela — a página não rola e não sobra faixa vazia embaixo (conferido em 1629×868, 1366×680 e 1920×1080: documento = janela, folga = só o preenchimento padrão). (2) **Abas numa linha só** (`components/modulo/abas-com-mais.tsx`, `AbasComMais`): mede cada aba com uma cópia invisível; o que não cabe vai para o botão "⋯" (Mais), e a aba aberta nunca some (toma o lugar da última visível). Usado no painel da emenda; **faixa de abas nova = `AbasComMais`**. (3) **Nenhum botão corta texto**: botões de texto não têm mais altura fixa (`h-N` virou `min-h-N` + `py-1` + `text-center`) em `components/modulo/ui.tsx` (os três repositórios), `detalhe-emenda.tsx` e em ~36 botões `inline-flex`; rótulo longo quebra em mais linhas em vez de ser cortado. **Botão novo = `min-h-*`, nunca `h-*`** (exceto ícone quadrado `w-N h-N`). (4) **Selo da etapa com ressalva** (`SeloEtapa` + `ressalvaDaEtapa`, `components/emendas/ui.tsx`): etapa Paga (ou além) com pendência de saldo a registrar, empenho a anular ou pagamento parcial aparece em âmbar como "Paga · saldo a registrar" / "· empenho a anular" / "· pagamento parcial", com explicação no `title` — antes parecia emenda cumprida. A lista passa `financeiro` (valor, empenhado, pago e `res.regras`).

- **Divisão dos gráficos e busca por palavra (24/11/2026).** (1) Gráficos do painel esquerdo: `pesoDoGrafico(linhas)` (`lib/modulo/area-trabalho.ts`, nos três repositórios) — com **mais de 3 linhas cada um, os gráficos dividem a altura em partes iguais** (a lista do que tem mais opções rola por dentro); com 3 linhas ou menos o gráfico fica com o tamanho do que mostra (peso `linhas + 1,5`) e o resto vai para os outros. Mínimo de cada gráfico `min-h-[9rem]` (≈ cabeçalho + 3 linhas). Conferido: 263/262 px e 357/356 px com 6 × 16 opções; 2 opções × 16 → 144/381 px em 1366×680. **Gráfico novo usa `pesoDoGrafico`, nunca um peso próprio.** (2) **Busca por palavra procura em tudo que a linha mostra**: na lista de Emendas, também no texto das pendências abertas (`ResumoLinha.busca` = título, explicação e causas; ex.: "gestor" acha a publicidade incompleta do item XIV); em Pendências, título, explicação, causas e assunto (`textoDaLinha`); em Conformidade, os itens que faltam; em Imóveis, as pendências; em Frotas, a etapa; no Compras, modalidade, setor, fase, responsável e secretaria do processo. A busca com várias palavras exige todas, em qualquer ordem, sem acento nem caixa. **Coluna/texto novo mostrado numa linha de lista = entrar no texto da busca dela.**

- **Altura da área de trabalho sem sobra nem rolagem da página (24/11/2026).** `EspacoTrabalho` mede só o respiro de baixo (preenchimentos/margens dos contêineres, **sem somar irmãos**) e vai até o pé da janela; o mínimo é `320px` (não `rem`: com zoom do texto o `30rem` passava da janela e a página rolava — medido: 150% de zoom em 1440×800 dava documento de 941 px). Enquanto a área cabe (≥ 320 px) o `<html>` fica com `overflow-y: hidden` (sem barra de rolagem da página), voltando ao normal em janela minúscula, abaixo de 1024 px e ao sair da tela. Observa também tudo o que vem ANTES da área (cabeçalho, avisos): o corpo nunca "encolhe" abaixo da janela, então só observar o corpo não via um cabeçalho que diminuiu. Medido em 1615×802 (100 e 125%), 1440×800 (150%) e 1366×680 (100 e 125%): documento = janela, folga = só o respiro. **Cópia nos três repositórios.**
- **Caixa do título da emenda mostra o texto completo (24/11/2026).** O `objeto` da lista é um resumo cortado ("…"); com o pacote carregado a caixa do `<h2>` do painel usa a `descricao` (quando maior que o objeto), com `whitespace-pre-line`, largura 380 e teto de 16 rem. Sem isso a caixa repetia o mesmo texto cortado da tela.
- **Documentos faltando filtra a lista, não abre números (24/11/2026).** No gráfico de Pendências, a dimensão "Documentos faltando" agora é um filtro de verdade (`?d=<tipo do documento>`, em `FiltrosPainel`): clicar numa linha ou fatia troca a lista ao lado para as emendas que ainda não têm aquele documento (uma linha por emenda, `docsDoFiltro`), e clicar numa delas abre o painel da emenda já na aba Documentação. Documento e pendência são universos diferentes: escolher um documento larga os filtros g/r/a/m, e escolher gravidade/assunto/motivo/área larga o documento (tipo, secretaria e busca valem para os dois). Chip "Sem documento: …" e "Limpar" cobrem o filtro. **Filtro de gráfico nunca mostra links nem números soltos dentro do próprio gráfico.**
- **Divisão dos gráficos revista e indicadores com busca (24/11/2026).** `pesoDoGrafico`: mais de 3 linhas = 10 (partes iguais); 3 ou menos = `linhas + 6` (7 a 9). Antes valia `linhas + 1,5`, o que deixava um gráfico de uma única opção em miniatura ao lado de outro cheio (rosca minúscula). Regra: **nenhum gráfico vira miniatura; o de poucas linhas só leva um pouco menos.** Em `indicadores` (Pendências) o recorte de emendas agora inclui as emendas cujas PENDÊNCIAS casam com a busca por palavra; sem isso, buscar "gestor" mostrava "119 de 0 emendas" porque o texto da própria emenda não tem a palavra. Cópia de `pesoDoGrafico` nos três repositórios.
- **Gráficos sempre com a mesma altura (24/11/2026).** `pesoDoGrafico` devolve sempre 1: os gráficos do painel esquerdo dividem a altura em partes IGUAIS, com 1 opção ou com 16 (a lista de quem tem mais opções rola por dentro; mínimo `min-h-[9rem]`). Substitui as regras anteriores de peso por número de linhas. Cópia nos três repositórios.

## Emendas — conferência de dados 2026: processo, extratos e aditivos (24/11/2026)

Registro da sessão de conferência dos termos/planos/extratos com o banco. Pendências de decisão do dono: ver `docs/` do handoff de 24/11.
- **Processo administrativo = número do termo** (confirmado pelo dono): gravado em `execucao.processo_licitatorio` só onde estava vazio (~35 emendas pelos planos + 14 da Educação: 72, 91, 110, 114, 139, 142, 143, 144, 148, 150, 156, 187, 206, 209).
- **Correções de cadastro**: E101 `numero_termo` 121→111 (121 é da E94); vigências recalculadas como início + 12 meses (E23, 32, 34, 35, 37, 38, 47, 49, 50, 130, 157, 211, 213); nomes de gestores corrigidos (E113, E91/110/114, E38/130, E108, E150, E157, E32/34). Já corretos: Lorran **Gouveia** Lessa, **Nilton** (E43), **Sousa** (E103).
- **Extratos do jornal de 22/11/2026 (pág. 6)**: recortados com legenda de fonte, subidos em Drive PUBLICIDADE/EXTRATO e ligados em `documentos_drive` com `data_publicacao_extrato = 2026-11-22`: E110, E91, E114, E151, E160. Sem extrato ainda: E2, 6, 20, 29, 48, 66, 158, 165, 175, 176, 179, 186. O extrato da E94 do jornal de 04/10 saiu com nº 111 (erro de publicação; o correto é 121) e **não foi ligado**.
- **Termos aditivos de troca de conta** refeitos nos papéis timbrados (DOCX+PDF): Administração (18 emendas) e Esporte (E19, 20, 108, 176), em `docs/aditivos-conta-bancaria/termos-aditivos-administracao/` e `.../termos-aditivos-esporte/` (na branch `claude/optimistic-noether-x4jxva`; conferir se já estão na principal). Em branco de propósito: nº do aditivo, banco/agência/conta nova, endereço/representante.
- **Pagamento antes do extrato** (49 emendas): decisão do Controle Interno = extrato saneador; ainda sem campo próprio (ver "Rodada de 22/11/2026 (2)").
- **Armadilhas**: dois `UPDATE` na mesma linha em CTEs do mesmo comando — o 2º é ignorado em silêncio; empenhado líquido = empenhos − anulações (`v_emendas.empenhado` já traz certo); `next dev`/`build` reescrevem o `CLAUDE.md` e criam `AGENTS.md` (não commitar).

## Emendas — documentos públicos só pelo administrador, e tarja automática no ambiente (25/11/2026)

- **Quem liga documento do Drive** (`actions-drive.ts`): `vincularDocumentoDrive`, `removerDocumentoDrive` e `preencherPeloPdf` dos tipos que vão ao portal (`TIPOS_DRIVE_PUBLICOS`: termo, plano, extrato, anuência, relatório de gestão, convênio) passaram a exigir o **administrador da Central** (`ctx.usuario.admin_hub`, `exigirAdminDocumentos`). Motivo: gestores ligaram pela tela os originais **sem tarja** da pasta "Documentos novos" (termos e planos com CPF/RG/telefone do presidente e do Prefeito). Comprovação de cumprimento (nota fiscal, prestação de contas, internas) continua com o gestor. **A trava é só no servidor**: o formulário "Ligar documento do Drive" ainda aparece para gestor e responde com a mensagem de erro; esconder o formulário pede passar um `adminHub` até `AbaDocumentacao`. O app não consegue conferir em que pasta do Drive o arquivo está (não há API do Google no app), por isso a regra é por pessoa, não por pasta.
- **Procedimento de tarja neste ambiente (sem Tesseract)**: PyMuPDF + RapidOCR (`pip install pymupdf rapidocr-onnxruntime`). Os PDFs de termo e plano são **scans**: renderiza a página a 200 dpi, OCR por linha, caixa preta desenhada **na imagem** (não é camada) por CPF, RG, telefone, e-mail e endereço de pessoa física; **fica** CNPJ, conta, nome do dirigente e o telefone/e-mail institucional da Secretaria (rodapé). O OCR erra: conferir cada página com caixas desenhadas em vermelho e **reconferir o PDF final por OCR** (CPF/RG/e-mail/telefone sobrando). Armadilhas: o classificador de linha do RapidOCR lê texto de cabeça para baixo, então a orientação da página não aparece na confiança do OCR (olhar miniaturas de todas as páginas); o OCR pode pular uma linha inteira (conferir o preâmbulo do termo: RG/CPF do Prefeito e do presidente e o endereço dele); a regex de RG não pode casar "Órgão"/"Cargo". Extrato de jornal fotografado: recortar só a publicação (as de outras secretarias ficam fora), tirar a marca-texto usando o canal máx(R,G) e normalizar o fundo, legenda "Fonte: Jornal Cataguases, data".
- **Limite do conector do Drive**: `create_file` aceita ~3,1 MB de arquivo por chamada. Termo escaneado de 13 páginas a 200 dpi dá ~7 MB: reduzir para 62% da resolução e JPEG q50 (≈2,3 MB, legível; é o tamanho dos termos já publicados). O conector **não move** arquivos de outras contas ("OAuth scopes do not allow moving"): os originais continuam em "Documentos novos".

- **Meta legal do exercício no Painel de Emendas (26/11/2026)**: cartões translúcidos do herói (`Hero` em `painel-abertura.tsx`: Aprovado, Pago, Em restos a pagar, Falta empenhar p/ a lei, Falta pagar) mais uma faixa de status, alimentados por `Painel.meta` (`MetaExercicio`, `painel-abertura.ts`, testado). Aprovado = emendas não canceladas; dentro da lei = pago + restos a pagar (empenhado e não pago, Lei 4.320 art. 36); o que falta para a lei = valor sem empenho. Verde (`atingida`) quando o sem empenho é zero, vermelho caso contrário, (os vereadores pendentes seguem na barra por vereador do Painel; `Painel.meta.pendentes` tem a lista). Não desconta ainda o saldo não executado registrado na conciliação (`emendas.conciliacoes`/`encerramentos`): emenda encerrada com saldo registrado continua somando em "sem empenho" até esse desconto ser ligado. Não testado com os dados reais no navegador.
- **Teto de restos a pagar (26/11/2026)**: `emendas.exercicios.restos_teto_valor` (R$, nulo = não informado; migration `20261126000000`, aplicada; editável em Configurações › Exercício). `Painel.meta.minimoAPagar` = `max(0, (aprovado − pago) − teto)`: o mínimo que ainda falta PAGAR para que, empenhando o resto, o que sobrar em restos a pagar caiba no teto. O cartão "Mínimo a pagar p/ o limite de restos" fica vermelho (>0), verde (0) ou neutro "teto não informado". **O valor do teto NÃO foi definido pela plataforma**: vem de lei/orientação da CGM (a conferir); o dono estimou o mínimo em cerca de R$ 1,8 mi, o que corresponderia a um teto próximo de R$ 1,41 mi (≈ 27% do aprovado), hipótese não confirmada.
- **Limites legais do exercício (26/11/2026)**: Configurações › Exercício › "Limites legais" (`EditorLimitesLegais`, `salvarLimitesExercicio`, mesma regra de decisor do exercício). Colunas de `emendas.exercicios`: `percentual_rcl` (teto das emendas, % da RCL), `restos_teto_pct` (máximo em restos a pagar, % da RCL), `rcl`, `aprovado_loa_valor` (opcional) e `restos_teto_valor` (R$ manual, substitui o %); migration `20261126010000`. Regra pura `lib/emendas/limites-exercicio.ts` (`calcularLimites`, testada): **a RCL TEM de ser informada** (nunca se deduz do aprovado: em Cataguases a Câmara aprovou ACIMA de 2% da RCL de 2024); teto = RCL × % do teto, restos permitidos = RCL × % de restos (ou o valor manual); o painel recebe `tetoRestos` daí e `minimoAPagar = (aprovado − pago) − teto de restos`. 2026: 2% e 0,5% (definidos pelo dono). **Premissa**: os dois percentuais incidem sobre a RCL; enquanto ela não for informada, o painel mostra "informe a RCL" em teto, limite de restos e mínimo a pagar. O painel mostra o teto legal, o quanto o aprovado passa dele, o limite de restos e o mínimo a pagar. O valor aprovado pode vir da lei ou do total das emendas cadastradas (planilha importada); leitura automática do PDF da lei NÃO existe. Para o ano seguinte: abrir o exercício e preencher os percentuais (o assistente não os copia).
- **Aprovado pela Câmara × teto legal (26/11/2026)**: o teto de 2% da RCL é a OBRIGAÇÃO (`tetoValor`), mas a Câmara pode aprovar mais; por isso `aprovado_loa_valor` ("Valor efetivamente aprovado pela Câmara") é a BASE do painel quando informado (`EntradaPainel.aprovadoInformado` → `meta.aprovado`, `faltaPagar`, `semEmpenho`, `minimoAPagar`); vazio = soma das emendas. `meta.aprovadoAcimaDoTeto` mostra o quanto passa do teto e `meta.semEmendaCadastrada` o quanto do aprovado ainda não tem emenda. RCL de 2024 (usada em 2026) = R$ 262.445.898,73, gravada em `exercicios.rcl` (2% = R$ 5.248.917,97; restos 0,5% = R$ 1.312.229,49). Nada trava o aprovado num percentual da RCL.

## Exportar a lista filtrada, sempre (26/11/2026)

Regra do dono: **toda lista filtrada precisa poder ser exportada, com o que está na tela.** Emendas (lista e Panorama) e Pendências já tinham Excel/PDF pelo servidor; entraram: Conformidade (`/emendas/conformidade/exportar?formato=xlsx|pdf&i&s&t&x&q`, mesma `filtrarConformidade` da tela, em `lib/emendas/conformidade-lista.ts`; dados em `conformidade-dados.ts`), PDF da lista em Pendências (`formato=pdf`; com `?d=` sai a lista de emendas sem o documento) e, para Frotas e Imóveis, o botão **"Lista filtrada (CSV)"** do kit `AreaTrabalhoLista` (prop `exportar={{ arquivo, colunas }}`, `lib/modulo/csv.ts`): baixa no navegador exatamente os itens filtrados e ordenados, inclusive com os filtros clicados nos gráficos (que o Excel/PDF do servidor de Frotas/Imóveis não conhecem). **Tela nova de lista = `exportar` com as colunas** (kit) ou rota de exportação que reuse a função de filtro da tela. Requerimentos (outro repositório) ainda não tem.
Motivos da publicidade nas Pendências: rótulo "Art. 7º, XIV · Gestor responsável" (igual à Conformidade), sem o prefixo do assunto no gráfico.
