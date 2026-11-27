import "server-only";

import { envGoogle } from "@/lib/env";
import { decifrar } from "@/lib/documentos/cripto";
import { renovarToken } from "@/lib/documentos/google";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

/**
 * Conexão da instituição com o armazenamento de documentos (hoje: Google Drive). Fica em `hub.armazenamento_config`,
 * que só a chave de serviço alcança: o navegador nunca recebe o token. Quem chama aqui já checou a permissão da pessoa.
 */
export type ConfigArmazenamento = {
  provedor: string;
  conta_email: string | null;
  token_cifrado: string | null;
  pasta_raiz_id: string | null;
  pasta_raiz_nome: string | null;
  pasta_originais_id: string | null;
  pasta_publicada_id: string | null;
  pasta_internos_id: string | null;
  conectado_em: string | null;
  ultimo_erro: string | null;
};

export async function lerConfig(): Promise<ConfigArmazenamento | null> {
  const hub = criarClienteAdminBruto().schema("hub");
  const { data, error } = await hub.from("armazenamento_config").select("*").eq("id", "principal").maybeSingle();
  if (error) {
    console.error("[documentos:lerConfig]", error);
    throw new Error("Não foi possível ler a configuração de documentos.");
  }
  return (data as ConfigArmazenamento | null) ?? null;
}

export async function gravarConfig(campos: Partial<ConfigArmazenamento> & { conectado_por?: string | null }): Promise<void> {
  const hub = criarClienteAdminBruto().schema("hub");
  const { error } = await hub.from("armazenamento_config").upsert({ id: "principal", ...campos, atualizado_em: new Date().toISOString() });
  if (error) {
    console.error("[documentos:gravarConfig]", error);
    throw new Error("Não foi possível gravar a configuração de documentos.");
  }
}

/** O que a tela pode mostrar: nunca o token. */
export type StatusArmazenamento = {
  configuradoNoServidor: boolean;
  conectado: boolean;
  email: string | null;
  pastaRaiz: string | null;
  pastasProntas: boolean;
  conectadoEm: string | null;
  ultimoErro: string | null;
};

export async function statusArmazenamento(): Promise<StatusArmazenamento> {
  const [cfg, google] = [await lerConfig(), envGoogle()];
  return {
    configuradoNoServidor: !!google,
    conectado: !!cfg?.token_cifrado,
    email: cfg?.conta_email ?? null,
    pastaRaiz: cfg?.pasta_raiz_nome ?? null,
    pastasProntas: !!(cfg?.pasta_originais_id && cfg.pasta_publicada_id && cfg.pasta_internos_id),
    conectadoEm: cfg?.conectado_em ?? null,
    ultimoErro: cfg?.ultimo_erro ?? null,
  };
}

const cacheToken = new Map<string, { token: string; expiraEm: number }>();

/** Token de acesso do Drive conectado (renovado quando preciso). Lança se não houver conexão. */
export async function tokenDeAcesso(): Promise<{ token: string; cfg: ConfigArmazenamento }> {
  const google = envGoogle();
  if (!google) throw new Error("O Google Drive ainda não foi configurado neste ambiente.");
  const cfg = await lerConfig();
  if (!cfg?.token_cifrado) throw new Error("O Google Drive ainda não está conectado. Peça ao administrador em Configurações → Documentos.");
  const emCache = cacheToken.get(cfg.token_cifrado);
  if (emCache && emCache.expiraEm > Date.now()) return { token: emCache.token, cfg };
  try {
    const refresh = decifrar(cfg.token_cifrado, google.DOCUMENTOS_CHAVE_CRIPTO);
    const r = await renovarToken({ clientId: google.GOOGLE_OAUTH_CLIENT_ID, clientSecret: google.GOOGLE_OAUTH_CLIENT_SECRET }, refresh);
    cacheToken.set(cfg.token_cifrado, { token: r.accessToken, expiraEm: r.expiraEm });
    if (cfg.ultimo_erro) void gravarConfig({ ultimo_erro: null }).catch(() => undefined);
    return { token: r.accessToken, cfg };
  } catch (e) {
    void gravarConfig({ ultimo_erro: "A autorização do Google venceu ou foi retirada. Conecte o Drive de novo." }).catch(() => undefined);
    throw e;
  }
}

/** Só um sim/não: o detalhe da emenda usa para mostrar ou esconder o envio. Não expõe conta nem pastas. */
export async function armazenamentoPronto(): Promise<boolean> {
  if (!envGoogle()) return false;
  const cfg = await lerConfig().catch(() => null);
  return !!(cfg?.token_cifrado && cfg.pasta_originais_id && cfg.pasta_internos_id);
}
