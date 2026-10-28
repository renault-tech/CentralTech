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

