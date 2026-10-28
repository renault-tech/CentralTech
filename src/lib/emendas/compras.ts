import "server-only";

import { classificarBusca, interpretarNumeroProcesso, palavrasChave } from "@/lib/emendas/numero-processo";
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
  /** Contratos cadastrados para este processo (módulo Contratos do Compras). */
  contratos: { numero: string; tipo: string | null; credor: string | null; data_vencimento: string | null }[];
};

const COLUNAS = "id,numero,numero_licitacao,objeto,status,data_sessao,data_publicacao,contrato_vinculado,modalidade_id,setor_atual_id";

async function enriquecer(p: Record<string, unknown>): Promise<ProcessoCompras> {
  const admin = criarClienteAdminBruto().schema("public");
  const [mod, setor, contratos] = await Promise.all([
    p.modalidade_id ? admin.from("modalidades").select("nome").eq("id", p.modalidade_id as string).maybeSingle() : Promise.resolve({ data: null }),
    p.setor_atual_id ? admin.from("setores").select("nome").eq("id", p.setor_atual_id as string).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("contratos_vigentes").select("numero,tipo,credor,data_vencimento").eq("processo_id", p.id as string).is("excluido_em", null).order("criado_em").limit(5),
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
    contratos: ((contratos.data ?? []) as ProcessoCompras["contratos"]).map((c) => ({
      numero: c.numero,
      tipo: c.tipo ?? null,
      credor: c.credor ?? null,
      data_vencimento: c.data_vencimento ?? null,
    })),
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

export type SugestaoProcesso = { id: string; numero: string; numero_licitacao: string | null; objeto: string; status: string };

/**
 * Sugestões para o campo de vínculo: pelo que a pessoa digita (parte do número ou palavras do
 * objeto) ou, com o campo vazio, pelas palavras do objeto da emenda. Poucas colunas, no máximo 6
 * linhas, só depois de a ação confirmar que a pessoa edita a emenda.
 */
export async function sugerirProcessos(texto: string, objetoEmenda: string): Promise<SugestaoProcesso[]> {
  const consulta = classificarBusca(texto);
  const admin = criarClienteAdminBruto().schema("public");
  let q = admin.from("processos").select("id,numero,numero_licitacao,objeto,status").order("criado_em", { ascending: false }).limit(consulta.tipo === "vazia" ? 40 : 8);
  let pistas: string[] = [];

  if (consulta.tipo === "numero") {
    // O trecho pode ser do processo, da licitação ou do contrato (módulo Contratos).
    const { data: cs } = await admin.from("contratos_vigentes").select("processo_id").ilike("numero", `%${consulta.trecho}%`).is("excluido_em", null).not("processo_id", "is", null).limit(8);
    const ids = (cs ?? []).map((c) => c.processo_id as string).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    q = q.or(`numero.ilike.%${consulta.trecho}%,numero_licitacao.ilike.%${consulta.trecho}%${ids.length ? `,id.in.(${ids.join(",")})` : ""}`);
  } else if (consulta.tipo === "texto") {
    for (const p of consulta.palavras) q = q.ilike("objeto", `%${p}%`);
  } else {
    pistas = palavrasChave(objetoEmenda);
    if (!pistas.length) return [];
    q = q.or(pistas.map((p) => `objeto.ilike.%${p}%`).join(","));
  }

  const { data } = await q;
  const linhas = (data ?? []).map((p) => ({
    id: p.id as string,
    numero: p.numero as string,
    numero_licitacao: (p.numero_licitacao as string | null) ?? null,
    objeto: ((p.objeto as string) ?? "").slice(0, 200),
    status: String(p.status ?? ""),
  }));
  if (!pistas.length) return linhas.slice(0, 6);
  const pontos = (o: string) => pistas.filter((w) => o.toLowerCase().includes(w)).length;
  return linhas.sort((a, b) => pontos(b.objeto) - pontos(a.objeto)).slice(0, 6);
}
