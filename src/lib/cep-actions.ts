"use server";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { buscarCep, type EnderecoCep } from "@/lib/cep";
import { excedeuLimite, ipDoCliente } from "@/lib/seguranca/limite-requisicoes";

export type RespostaCep = { sucesso: true; endereco: EnderecoCep } | { sucesso: false; erro: string };

/**
 * Consulta o endereço de um CEP (ViaCEP, com a BrasilAPI de reserva). Só para quem está logado e ativo, com limite por IP; a chamada
 * sai do servidor, então não depende de CORS nem da CSP do navegador. Nada é gravado aqui.
 */
export async function consultarCep(cep: string): Promise<RespostaCep> {
  const usuario = await obterUsuarioAtual();
  if (!usuario || !usuario.ativo) return { sucesso: false, erro: "Entre na Central para consultar o CEP." };
  if (await excedeuLimite("consultar-cep", await ipDoCliente(), 60, 300)) {
    return { sucesso: false, erro: "Muitas consultas em pouco tempo. Aguarde alguns minutos ou digite o endereço." };
  }
  const r = await buscarCep(String(cep ?? ""), fetch);
  if (r.ok) return { sucesso: true, endereco: r.endereco };
  if (r.motivo === "invalido") return { sucesso: false, erro: "CEP inválido: informe os 8 números." };
  if (r.motivo === "nao_encontrado") return { sucesso: false, erro: "CEP não encontrado. Confira os números ou digite o endereço." };
  return { sucesso: false, erro: "Não consegui consultar o CEP agora. Digite o endereço." };
}
