import "server-only";

import { interpretarNumeroProcesso } from "@/lib/emendas/numero-processo";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";

/**
 * Leitura do processo do Compras ligado a uma emenda. Usa a chave de serviço (a RLS do
 * Compras barra quem não tem `public.usuarios`), por isso é estreita: só lê UM processo,
 * pelo número que a própria emenda guarda, e só depois de a tela confirmar que a pessoa
 * vê a emenda. Devolve poucas colunas, nunca a lista.
 */
export type ProcessoCompras = {
  id: string;
  numero: string;
  numero_licitacao: string | null;
  objeto: string;
  status: string;
  modalidade: string | null;
  setor: string | null;
  data_sessao: string | null;
  data_publicacao: string | null;
  contrato_vinculado: string | null;
};

const COLUNAS = "id,numero,numero_licitacao,objeto,status,data_sessao,data_publicacao,contrato_vinculado,modalidade_id,setor_atual_id";

async function enriquecer(p: Record<string, unknown>): Promise<ProcessoCompras> {
  const admin = criarClienteAdminBruto().schema("public");
  const [mod, setor] = await Promise.all([
    p.modalidade_id ? admin.from("modalidades").select("nome").eq("id", p.modalidade_id as string).maybeSingle() : Promise.resolve({ data: null }),
    p.setor_atual_id ? admin.from("setores").select("nome").eq("id", p.setor_atual_id as string).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    id: p.id as string,
    numero: p.numero as string,
    numero_licitacao: (p.numero_licitacao as string | null) ?? null,
    objeto: (p.objeto as string) ?? "",
    status: String(p.status ?? ""),
    modalidade: (mod.data as { nome: string } | null)?.nome ?? null,
    setor: (setor.data as { nome: string } | null)?.nome ?? null,
    data_sessao: (p.data_sessao as string | null) ?? null,
    data_publicacao: (p.data_publicacao as string | null) ?? null,
    contrato_vinculado: (p.contrato_vinculado as string | null) ?? null,
  };
}

/** Procura o processo pelo número digitado (AAAA/NNNN ou NNN/AAAA). */
export async function buscarProcessoPorNumero(texto: string): Promise<ProcessoCompras | null> {
  const busca = interpretarNumeroProcesso(texto);
  if (!busca) return null;
  const admin = criarClienteAdminBruto().schema("public");
  const { data } = await admin.from("processos").select(COLUNAS).eq(busca.coluna, busca.valor).limit(1).maybeSingle();
  return data ? enriquecer(data) : null;
}

export async function buscarProcessoPorId(id: string): Promise<ProcessoCompras | null> {
  const admin = criarClienteAdminBruto().schema("public");
  const { data } = await admin.from("processos").select(COLUNAS).eq("id", id).maybeSingle();
  return data ? enriquecer(data) : null;
}
