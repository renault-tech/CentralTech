import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteNumera } from "@/lib/supabase/numera-cliente";
import type { SolicitacaoAcesso } from "@/types/database";
import type { CatalogoItem, DocumentoNumera } from "@/lib/catalogos-solicitacao";

// Reexportadas daqui por compatibilidade — quem já importava as constantes
// de `lib/dados/solicitacoes` continua funcionando; o módulo puro em si
// fica em `lib/catalogos-solicitacao.ts` (mesmo padrão de `rotulos.ts`/
// `chaves.ts` já usado no Compras para separar puro de server-only).
export {
  PERFIS_COMPRAS,
  PERFIS_COMPRAS_SEM_SETOR,
  PERFIS_REQUERIMENTOS,
  NIVEIS_NUMERA,
  type CatalogoItem,
  type DocumentoNumera,
} from "@/lib/catalogos-solicitacao";

export async function listarSolicitacoesPendentes(): Promise<SolicitacaoAcesso[]> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("solicitacoes_acesso")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true });

  if (error) {
    console.error("[listarSolicitacoesPendentes] falha:", error);
    throw new Error("Não foi possível carregar as solicitações.");
  }

  return data ?? [];
}

export async function listarSetoresCompras(): Promise<CatalogoItem[]> {
  const admin = criarClienteAdminBruto();
  const { data, error } = await admin.schema("public").from("setores").select("id,nome").order("ordem");
  if (error) {
    console.error("[listarSetoresCompras] falha:", error);
    throw new Error("Não foi possível carregar os setores do Compras.");
  }
  return (data ?? []) as CatalogoItem[];
}

export async function listarSecretariasRequerimentos(): Promise<CatalogoItem[]> {
  const admin = criarClienteAdminBruto();
  const { data, error } = await admin
    .schema("requerimentos")
    .from("secretarias")
    .select("id,nome")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    console.error("[listarSecretariasRequerimentos] falha:", error);
    throw new Error("Não foi possível carregar as secretarias do Requerimentos.");
  }
  return (data ?? []) as CatalogoItem[];
}

export async function listarDocumentosNumera(): Promise<DocumentoNumera[]> {
  const { data, error } = await criarClienteNumera()
    .from("documents")
    .select("id,name")
    .eq("enabled", true)
    .order("name");
  if (error) {
    console.error("[listarDocumentosNumera] falha:", error);
    throw new Error("Não foi possível carregar os documentos do Numera.");
  }
  return (data ?? []) as DocumentoNumera[];
}
