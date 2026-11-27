import { NextResponse, type NextRequest } from "next/server";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { envGoogle } from "@/lib/env";
import { cifrar } from "@/lib/documentos/cripto";
import { gravarConfig, lerConfig } from "@/lib/documentos/config";
import { emailDaConta, trocarCodigo } from "@/lib/documentos/google";
import { origemDaRequisicao } from "@/lib/origem";

/** Volta do Google: confere o state, troca o código pelo token e guarda a autorização cifrada. */
export async function GET(req: NextRequest) {
  const origem = await origemDaRequisicao();
  const voltar = (q: string) => NextResponse.redirect(new URL(`/configuracoes/documentos?${q}`, origem));
  const usuario = await obterUsuarioAtual();
  if (!usuario?.ativo || !usuario.admin_hub) return NextResponse.redirect(new URL("/", origem));
  const google = envGoogle();
  if (!google) return voltar("erro=sem_credenciais");

  const params = req.nextUrl.searchParams;
  const esperado = req.cookies.get("docs_oauth_state")?.value;
  if (params.get("error")) return voltar("erro=negado");
  if (!esperado || params.get("state") !== esperado) return voltar("erro=state");
  const codigo = params.get("code");
  if (!codigo) return voltar("erro=codigo");

  try {
    const t = await trocarCodigo({ clientId: google.GOOGLE_OAUTH_CLIENT_ID, clientSecret: google.GOOGLE_OAUTH_CLIENT_SECRET }, codigo, `${origem}/api/documentos/google/callback`);
    const atual = await lerConfig();
    // Sem refresh token novo e sem um antigo, não há como continuar conectado.
    if (!t.refreshToken && !atual?.token_cifrado) return voltar("erro=sem_refresh");
    const email = await emailDaConta(t.accessToken);
    const mudouConta = !!atual?.conta_email && !!email && atual.conta_email !== email;
    await gravarConfig({
      provedor: "google_drive",
      conta_email: email,
      ...(t.refreshToken ? { token_cifrado: cifrar(t.refreshToken, google.DOCUMENTOS_CHAVE_CRIPTO) } : {}),
      conectado_em: new Date().toISOString(),
      conectado_por: usuario.id,
      ultimo_erro: null,
      // Outra conta não enxerga as pastas da anterior: as pastas precisam ser escolhidas de novo.
      ...(mudouConta ? { pasta_raiz_id: null, pasta_raiz_nome: null, pasta_originais_id: null, pasta_publicada_id: null, pasta_internos_id: null } : {}),
    });
  } catch (e) {
    console.error("[documentos:callback]", e);
    return voltar("erro=falha");
  }
  const resposta = voltar("conectado=1");
  resposta.cookies.delete({ name: "docs_oauth_state", path: "/api/documentos/google" });
  return resposta;
}
