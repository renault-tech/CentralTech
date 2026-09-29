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
