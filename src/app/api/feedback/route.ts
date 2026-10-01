import { NextResponse, type NextRequest } from "next/server";

import { MODULOS } from "@/lib/modulos-info";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada do feedback para apps de OUTRO projeto Supabase (hoje só
 * o Numera). Os apps do projeto compartilhado gravam direto pela RPC
 * `hub.enviar_feedback`; o Numera não consegue (auth.users separado), então
 * manda o token da sessão dele para cá, validamos com a service_role do
 * projeto dele e gravamos na mesma tabela central com app = 'numera'.
 * A identidade vem SEMPRE do token — nunca de campo do corpo.
 */
const ORIGEM_NUMERA = MODULOS.numera.url;
const BUCKET = "feedback-anexos";
const MAX_ANEXOS = 5;
const MAX_ARQUIVO = 3 * 1024 * 1024; // Vercel limita o corpo a ~4,5MB
const MAX_TOTAL = 4 * 1024 * 1024;
const MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];

function comCors(r: NextResponse): NextResponse {
  r.headers.set("Access-Control-Allow-Origin", ORIGEM_NUMERA);
  r.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  r.headers.set("Vary", "Origin");
  return r;
}

export async function OPTIONS() {
  return comCors(new NextResponse(null, { status: 204 }));
}

async function identificar(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const numera = criarClienteNumeraAdmin();
  const { data, error } = await numera.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await numera.from("users").select("name, approved").eq("id", data.user.id).maybeSingle();
  if (perfil && perfil.approved === false) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    nome: (perfil?.name as string | undefined) || data.user.email || "Usuário",
  };
}

export async function GET(request: NextRequest) {
  const eu = await identificar(request);
  if (!eu) return comCors(NextResponse.json({ erro: "Não autenticado." }, { status: 401 }));
  const admin = criarClienteAdmin();
  const { data } = await admin
    .from("feedback")
    .select("id, tipo, mensagem, status, criado_em")
    .eq("app", "numera")
    .eq("usuario_id", eu.id)
    .order("criado_em", { ascending: false })
    .limit(50);
  return comCors(NextResponse.json({ itens: data ?? [] }));
}

export async function POST(request: NextRequest) {
  const eu = await identificar(request);
  if (!eu) return comCors(NextResponse.json({ erro: "Não autenticado." }, { status: 401 }));

  const form = await request.formData().catch(() => null);
  if (!form) return comCors(NextResponse.json({ erro: "Dados inválidos." }, { status: 400 }));

  const tipo = String(form.get("tipo") ?? "");
  const mensagem = String(form.get("mensagem") ?? "").trim();
  const pagina = String(form.get("pagina") ?? "").trim().slice(0, 200);
  if (tipo !== "suporte" && tipo !== "sugestao") {
    return comCors(NextResponse.json({ erro: "Tipo inválido." }, { status: 400 }));
  }
  if (mensagem.length < 5 || mensagem.length > 4000) {
    return comCors(NextResponse.json({ erro: "Escreva um pouco mais." }, { status: 400 }));
  }

  const arquivos = form.getAll("anexos").filter((f): f is File => f instanceof File);
  if (arquivos.length > MAX_ANEXOS) {
    return comCors(NextResponse.json({ erro: `Máximo de ${MAX_ANEXOS} anexos.` }, { status: 400 }));
  }
  let total = 0;
  for (const f of arquivos) {
    total += f.size;
    if (f.size > MAX_ARQUIVO || !MIMES.includes(f.type)) {
      return comCors(NextResponse.json({ erro: `Anexo "${f.name}" inválido (até 3MB; imagem, PDF ou texto).` }, { status: 400 }));
    }
  }
  if (total > MAX_TOTAL) {
    return comCors(NextResponse.json({ erro: "Anexos somam mais de 4MB." }, { status: 400 }));
  }

  const admin = criarClienteAdmin();
  const caminhos: string[] = [];
  for (const f of arquivos) {
    const nome = f.name.replace(/[^\w.-]/g, "_");
    const caminho = `numera/${eu.id}/${crypto.randomUUID()}-${nome}`;
    const { error } = await admin.storage.from(BUCKET).upload(caminho, f, { contentType: f.type });
    if (error) return comCors(NextResponse.json({ erro: `Não foi possível enviar "${f.name}".` }, { status: 500 }));
    caminhos.push(caminho);
  }

  const { error } = await admin.from("feedback").insert({
    app: "numera",
    usuario_id: eu.id,
    autor_nome: eu.nome,
    autor_email: eu.email,
    tipo,
    mensagem,
    pagina: pagina || null,
    anexos: caminhos,
  });
  if (error) {
    console.error("[api/feedback] insert", error);
    return comCors(NextResponse.json({ erro: "Não foi possível enviar." }, { status: 500 }));
  }
  return comCors(NextResponse.json({ ok: true }));
}
