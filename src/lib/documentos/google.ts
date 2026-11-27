import "server-only";

/**
 * Cliente mínimo da API do Google Drive (OAuth + arquivos). Só o que a plataforma usa: autorizar, criar pastas, abrir uma
 * sessão de envio retomável (o navegador envia o arquivo direto ao Google) e ler/baixar. Funciona com o escopo `drive.file`:
 * o app só enxerga o que ele mesmo criou ou o que a pessoa escolheu no seletor do Google.
 * Este é o único arquivo que conhece o Google: outros provedores entram por uma camada parecida (ver `armazenamento.ts`).
 */
const AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/drive/v3";
const ENVIO = "https://www.googleapis.com/upload/drive/v3";

export const ESCOPOS_GOOGLE = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"];
export const MIME_PASTA = "application/vnd.google-apps.folder";

export class ErroGoogle extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly codigo?: string
  ) {
    super(mensagem);
  }
}

async function falhar(r: Response, onde: string): Promise<never> {
  let detalhe = "";
  let codigo: string | undefined;
  try {
    const j = (await r.json()) as { error?: string | { message?: string; status?: string }; error_description?: string };
    if (typeof j.error === "string") {
      codigo = j.error;
      detalhe = j.error_description ?? j.error;
    } else {
      codigo = j.error?.status;
      detalhe = j.error?.message ?? "";
    }
  } catch {
    /* corpo vazio */
  }
  throw new ErroGoogle(`Google (${onde}): ${detalhe || r.status}`, r.status, codigo);
}

export function urlAutorizacao(p: { clientId: string; redirectUri: string; state: string; email?: string }): string {
  const u = new URL(AUTORIZACAO);
  u.searchParams.set("client_id", p.clientId);
  u.searchParams.set("redirect_uri", p.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS_GOOGLE.join(" "));
  // `offline` + `consent` garantem o refresh token mesmo numa segunda conexão.
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", p.state);
  if (p.email) u.searchParams.set("login_hint", p.email);
  return u.toString();
}

type Credenciais = { clientId: string; clientSecret: string };

export async function trocarCodigo(c: Credenciais, codigo: string, redirectUri: string): Promise<{ refreshToken: string | null; accessToken: string }> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: codigo, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!r.ok) return falhar(r, "trocar código");
  const j = (await r.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: j.access_token, refreshToken: j.refresh_token ?? null };
}

export async function renovarToken(c: Credenciais, refreshToken: string): Promise<{ accessToken: string; expiraEm: number }> {
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!r.ok) return falhar(r, "renovar autorização");
  const j = (await r.json()) as { access_token: string; expires_in?: number };
  return { accessToken: j.access_token, expiraEm: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000 };
}

export async function emailDaConta(accessToken: string): Promise<string | null> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!r.ok) return null;
  return ((await r.json()) as { email?: string }).email ?? null;
}

export type ArquivoDrive = { id: string; name: string; mimeType: string; size?: string; parents?: string[]; trashed?: boolean };

const CAMPOS = "id,name,mimeType,size,parents,trashed";

export async function lerArquivo(token: string, id: string): Promise<ArquivoDrive> {
  const r = await fetch(`${API}/files/${encodeURIComponent(id)}?fields=${CAMPOS}&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return falhar(r, "ler arquivo");
  return (await r.json()) as ArquivoDrive;
}

export async function criarPasta(token: string, nome: string, paiId: string | null): Promise<ArquivoDrive> {
  const r = await fetch(`${API}/files?fields=${CAMPOS}&supportsAllDrives=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ name: nome, mimeType: MIME_PASTA, ...(paiId ? { parents: [paiId] } : {}) }),
    cache: "no-store",
  });
  if (!r.ok) return falhar(r, "criar pasta");
  return (await r.json()) as ArquivoDrive;
}

const aspas = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Acha a subpasta pelo nome dentro do pai; se não existir, cria. Uma consulta + (às vezes) uma criação. */
export async function garantirSubpasta(token: string, paiId: string, nome: string): Promise<string> {
  const q = `name = '${aspas(nome)}' and '${aspas(paiId)}' in parents and mimeType = '${MIME_PASTA}' and trashed = false`;
  const r = await fetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return falhar(r, "buscar pasta");
  const achado = ((await r.json()) as { files?: { id: string }[] }).files?.[0]?.id;
  return achado ?? (await criarPasta(token, nome, paiId)).id;
}

/**
 * Abre uma sessão de envio retomável. O `Origin` do navegador precisa constar aqui: é ele que faz o Google aceitar
 * o envio direto da página (CORS) e devolver o id do arquivo ao fim.
 */
export async function iniciarEnvio(token: string, p: { nome: string; paiId: string; mime: string; tamanho: number; origem: string }): Promise<string> {
  const r = await fetch(`${ENVIO}/files?uploadType=resumable&fields=${CAMPOS}&supportsAllDrives=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": p.mime,
      "X-Upload-Content-Length": String(p.tamanho),
      Origin: p.origem,
    },
    body: JSON.stringify({ name: p.nome, parents: [p.paiId] }),
    cache: "no-store",
  });
  if (!r.ok) return falhar(r, "abrir envio");
  const url = r.headers.get("location");
  if (!url) throw new ErroGoogle("Google não devolveu o endereço de envio.", 502);
  return url;
}

/** Conteúdo do arquivo, em fluxo (não carrega o PDF inteiro na memória). */
export async function baixar(token: string, id: string): Promise<Response> {
  const r = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) return falhar(r, "baixar arquivo");
  return r;
}

/** Mensagem curta para a pessoa, sem vazar o corpo da resposta do Google. */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroGoogle) {
    if (e.codigo === "invalid_grant") return "A autorização do Google venceu ou foi retirada. Peça ao administrador para conectar o Drive de novo.";
    if (e.status === 404) return "O Google não encontrou o arquivo ou a pasta. Se a pasta foi movida ou apagada, escolha-a de novo em Configurações → Documentos.";
    if (e.status === 403) return "O Google recusou o acesso. Confira se a conta conectada ainda tem a pasta e espaço livre.";
    if (e.status === 401) return "A autorização do Google não vale mais. Conecte o Drive de novo em Configurações → Documentos.";
  }
  return "Não foi possível falar com o Google Drive agora. Tente de novo em instantes.";
}
