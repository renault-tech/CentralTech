/**
 * Constantes puras (sem dependência de servidor) usadas tanto pela leitura
 * de dados (`lib/dados/solicitacoes.ts`, Server Component) quanto pelo
 * formulário de decisão (`components/hub/painel-solicitacoes.tsx`, Client
 * Component) — regra da casa (documentada no CLAUDE.md do Compras):
 * constantes puras usadas por Client Components não podem viver no mesmo
 * módulo que código server-only, ou o bundle do cliente quebra ("You're
 * importing a module that depends on 'next/headers'...").
 */

export type CatalogoItem = { id: string; nome: string };
export type DocumentoNumera = { id: string; name: string };

/** Perfis do Compras (`public.perfil_usuario`) — lista fixa, mesma do enum do banco. */
export const PERFIS_COMPRAS = [
  "admin",
  "diretor",
  "coord_compras",
  "coord_licitacoes",
  "coord_contratos",
  "serv_compras",
  "serv_licitacoes",
  "serv_contratos",
  "procuradoria",
  "visualizador",
] as const;

/** Perfis sem setor no Compras — mesma regra de `PERFIS_SEM_SETOR` de lá. */
export const PERFIS_COMPRAS_SEM_SETOR = ["admin", "diretor", "visualizador"];

/** Perfis do Requerimentos (`requerimentos.perfil_usuario`). */
export const PERFIS_REQUERIMENTOS = ["admin", "diretor", "gabinete", "secretaria"] as const;

/** Níveis de acesso do Numera (`PERMISSION_LEVELS` em app.js). */
export const NIVEIS_NUMERA = [
  { valor: "admin", rotulo: "Administrador" },
  { valor: "user_full", rotulo: "Usuário Completo" },
  { valor: "user_restricted", rotulo: "Usuário Restrito" },
  { valor: "user_readonly", rotulo: "Somente Leitura" },
] as const;
