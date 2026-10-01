import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { AppFeedback, FeedbackCentral, StatusFeedback, TipoFeedback } from "@/types/database";

export type FeedbackComAnexos = FeedbackCentral & { anexosUrl: string[] };

/** `status` pode ser um único valor ou uma lista (ex.: os pendentes = novo + lido). */
export type FiltrosFeedback = { app?: AppFeedback; tipo?: TipoFeedback; status?: StatusFeedback | StatusFeedback[] };

/** Ainda exigem ação de quem gerencia — a visão padrão da gestão. */
export const STATUS_PENDENTES: StatusFeedback[] = ["novo", "lido"];

const VALIDADE_URL_SEGUNDOS = 60 * 10;
const BUCKET = "feedback-anexos";

/** Bucket privado: gera URLs assinadas (service_role, depois que a RLS já
 * decidiu quais linhas a pessoa pode ver — anexos do Numera ficam em
 * `numera/...`, fora do alcance das policies de Storage do usuário). */
async function comUrls(linhas: FeedbackCentral[]): Promise<FeedbackComAnexos[]> {
  const caminhos = Array.from(new Set(linhas.flatMap((f) => f.anexos)));
  const mapa = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data } = await criarClienteAdmin().storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_URL_SEGUNDOS);
    for (const u of data ?? []) if (u.path && u.signedUrl) mapa.set(u.path, u.signedUrl);
  }
  return linhas.map((f) => ({ ...f, anexosUrl: f.anexos.map((c) => mapa.get(c) ?? "").filter(Boolean) }));
}

/** Gestão: a RLS devolve tudo a admin do Hub / admin e diretor do Compras;
 * para os demais devolve só os próprios (por isso `listarMeus` existe à parte). */
export async function listarFeedbackGestao(filtros: FiltrosFeedback = {}): Promise<FeedbackComAnexos[]> {
  const supabase = await criarClienteServidor();
  let q = supabase.from("feedback").select("*").order("criado_em", { ascending: false }).limit(300);
  if (filtros.app) q = q.eq("app", filtros.app);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  if (filtros.status) {
    q = Array.isArray(filtros.status) ? q.in("status", filtros.status) : q.eq("status", filtros.status);
  }
  const { data, error } = await q;
  if (error) throw new Error("Não foi possível carregar os feedbacks.");
  return comUrls(data ?? []);
}

export async function listarMeusFeedbacks(usuarioId: string): Promise<FeedbackComAnexos[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível carregar seus envios.");
  return comUrls(data ?? []);
}

export async function podeGerirFeedback(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("pode_gerir_feedback");
  return data === true;
}

export async function contarFeedbackNovos(): Promise<number> {
  const supabase = await criarClienteServidor();
  const { count, error } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("status", "novo");
  if (error) return 0;
  return count ?? 0;
}
