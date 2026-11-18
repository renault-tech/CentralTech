"use server";

import { buscarCnpj, type DadosCnpj } from "@/lib/cnpj";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { cnpjValido } from "@/lib/emendas/portal-verificacao";
import { ehGestor } from "@/lib/emendas/regras";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

export type RespostaCnpj = { sucesso: true; dados: DadosCnpj; jaCadastrado: { id: string; nome: string } | null } | { sucesso: false; erro: string };

/**
 * Consulta um CNPJ (BrasilAPI, dados públicos da Receita) para preencher o cadastro do beneficiário sem digitação. Só gestor, com
 * limite por IP. Nada é gravado aqui: a tela preenche o formulário e a pessoa confere antes de salvar. Avisa se o CNPJ já está cadastrado.
 */
export async function consultarCnpj(cnpj: string): Promise<RespostaCnpj> {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) return { sucesso: false, erro: "Só gestores cadastram beneficiários." };
  const d = String(cnpj ?? "").replace(/\D/g, "");
  if (d.length !== 14 || !cnpjValido(d)) return { sucesso: false, erro: "CNPJ inválido: confira os 14 dígitos." };
  if (await excedeuLimite("emendas-consultar-cnpj", await ipDoCliente(), 40, 300)) return { sucesso: false, erro: "Muitas consultas seguidas. Aguarde alguns minutos." };
  const r = await buscarCnpj(d, fetch);
  if (!r.ok) return { sucesso: false, erro: r.motivo === "nao_encontrado" ? "CNPJ não encontrado na Receita. Digite os dados." : "Não consegui consultar o CNPJ agora. Digite os dados." };
  const emendas = await criarClienteEmendas();
  const formatado = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  const { data } = await emendas.from("beneficiarios").select("id,nome").eq("cnpj", formatado).limit(1);
  return { sucesso: true, dados: r.dados, jaCadastrado: data?.[0] ? { id: data[0].id, nome: data[0].nome } : null };
}
