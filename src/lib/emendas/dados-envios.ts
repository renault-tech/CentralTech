import "server-only";

import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { DocumentoEnviadoRow } from "@/types/emendas";

export type EnvioListado = DocumentoEnviadoRow & { emenda_numero: number | null; emenda_objeto: string | null; autor_nome: string | null };

/** Envios que esperam decisão (gestor vê todos; os demais, só os próprios — a RLS decide). */
export async function listarEnviosPendentes(): Promise<EnvioListado[]> {
  const emendas = await criarClienteEmendas();
  const { data, error } = await emendas.from("documentos_enviados").select("*").eq("status", "aguardando").order("enviado_em", { ascending: true }).limit(200);
  if (error) {
    console.error("[emendas:envios]", error);
    throw new Error("Não foi possível carregar os documentos enviados.");
  }
  const envios = data ?? [];
  if (envios.length === 0) return [];
  const ids = Array.from(new Set(envios.map((e) => e.emenda_id)));
  const autores = Array.from(new Set(envios.map((e) => e.enviado_por)));
  const hub = await criarClienteServidor();
  const [{ data: ems }, { data: us }] = await Promise.all([emendas.from("v_emendas").select("id,numero,objeto").in("id", ids.slice(0, 150)), hub.from("usuarios").select("id,nome").in("id", autores)]);
  const porId = new Map((ems ?? []).map((e) => [e.id, e]));
  const nomes = new Map((us ?? []).map((u) => [u.id, u.nome]));
  return envios.map((e) => ({ ...e, emenda_numero: porId.get(e.emenda_id)?.numero ?? null, emenda_objeto: porId.get(e.emenda_id)?.objeto ?? null, autor_nome: nomes.get(e.enviado_por) ?? null }));
}
