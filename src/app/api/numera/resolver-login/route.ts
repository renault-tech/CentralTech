import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import { MODULOS } from "@/lib/modulos-info";
import { completarNoTempoMinimo, criarLimitadorPorChave } from "@/lib/anti-enumeracao";

export const dynamic = "force-dynamic";

/**
 * Resolve "usuário ou e-mail" (campo de login do Numera) para um e-mail de
 * verdade, sem expor a lista de usernames/e-mails para quem tentar
 * adivinhar (decisão já tomada no plano de migração de auth do Numera,
 * seção 6, PR3: "Login por username continua existindo, via função no
 * servidor — não RPC pública direta"). Uma RPC pública faria essa consulta
 * livremente disponível via REST (`select username, email from users`,
 * mesmo problema que a RLS aberta desta tabela já tem hoje); este endpoint
 * só devolve o e-mail de UM username por vez, sob a mesma proteção de
 * tempo-constante + janela de repetição do endpoint de recuperação de
 * senha.
 *
 * O front do Numera (`auth-service.js`) só chama isto quando o campo
 * digitado NÃO parece um e-mail — se já é um e-mail, usa direto, sem
 * consultar nada aqui.
 */

const ORIGEM_NUMERA = MODULOS.numera.url;

const esquema = z.object({ username: z.string().trim().min(1) });

function comCors(resposta: NextResponse): NextResponse {
  resposta.headers.set("Access-Control-Allow-Origin", ORIGEM_NUMERA);
  resposta.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  resposta.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return resposta;
}

export async function OPTIONS() {
  return comCors(new NextResponse(null, { status: 204 }));
}

const TEMPO_MINIMO_RESPOSTA_MS = 400;
const JANELA_REPETICAO_MS = 10_000;
const podeTentar = criarLimitadorPorChave(JANELA_REPETICAO_MS);

export async function POST(request: NextRequest) {
  const inicio = Date.now();
  const corpo = await request.json().catch(() => null);
  const analise = esquema.safeParse(corpo);
  if (!analise.success) {
    return comCors(NextResponse.json({ email: null }));
  }

  const username = analise.data.username;

  const email = await completarNoTempoMinimo(
    inicio,
    (async () => {
      if (!podeTentar(username)) return null;
      try {
        const numeraAdmin = criarClienteNumeraAdmin();
        const { data, error } = await numeraAdmin
          .from("users")
          .select("email")
          .eq("username", username)
          .maybeSingle();
        if (error || !data?.email) return null;
        return data.email as string;
      } catch (e) {
        console.error("[resolver-login numera] erro:", e);
        return null;
      }
    })(),
    TEMPO_MINIMO_RESPOSTA_MS
  );

  return comCors(NextResponse.json({ email }));
}
