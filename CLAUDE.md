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

## Como continuar de outro computador

1. `git clone`, `nvm use` (`.nvmrc`), `npm install --legacy-peer-deps`
   (mesmo workaround de `npm`/arborist já documentado no App-Compras).
2. `.env.local` a partir de `.env.example` — inclui as chaves do projeto
   compartilhado (mesmas do Compras) e, para o importador do Numera,
   `NUMERA_SUPABASE_URL`/`NUMERA_SUPABASE_ANON_KEY` (não são segredos —
   a mesma chave já vai hardcoded no client-side do próprio Numera).
3. `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` antes
   de considerar qualquer mudança concluída.
4. Migrations novas: `supabase/migrations/`, timestamp maior que o
   último, testadas transacionalmente no projeto `nfijlzndlioefayctbsh`
   antes de aplicar (mesmo processo documentado no CLAUDE.md do
   App-Compras — este repo compartilha o banco, não as regras têm que
   ser reinventadas).
