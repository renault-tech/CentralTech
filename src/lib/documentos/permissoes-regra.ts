/**
 * Quem pode enviar e quem pode analisar documentos. Puro: o padrão vem do perfil, e a instituição ajusta por pessoa em
 * Configurações → Documentos (valor `null` = vale o padrão). A RLS do módulo continua mandando: quem não edita a
 * emenda não consegue enviar, mesmo que a permissão avulsa diga "sim".
 */
export type PermissoesDocumentos = { enviar: boolean; analisar: boolean };
export type AjusteDocumentos = { pode_enviar: boolean | null; pode_analisar: boolean | null } | null;

export const PERFIS_QUE_ENVIAM = ["admin", "gestor", "admin_secretaria", "operador"] as const;
export const PERFIS_QUE_ANALISAM = ["admin", "gestor"] as const;

export function padraoDoPerfil(perfil: string | null): PermissoesDocumentos {
  return {
    enviar: !!perfil && (PERFIS_QUE_ENVIAM as readonly string[]).includes(perfil),
    analisar: !!perfil && (PERFIS_QUE_ANALISAM as readonly string[]).includes(perfil),
  };
}

export function resolverPermissoes(perfil: string | null, ajuste: AjusteDocumentos): PermissoesDocumentos {
  const base = padraoDoPerfil(perfil);
  // O administrador da Central sempre pode: não há como trancá-lo para fora.
  if (perfil === "admin") return { enviar: true, analisar: true };
  return { enviar: ajuste?.pode_enviar ?? base.enviar, analisar: ajuste?.pode_analisar ?? base.analisar };
}
