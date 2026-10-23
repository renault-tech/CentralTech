import { zipSync, strToU8 } from "fflate";
import { NextResponse } from "next/server";

import { listarFeedbackGestao, podeGerirFeedback, STATUS_PENDENTES } from "@/lib/dados/feedback";
import { APPS_FEEDBACK, ORDEM_APPS, ROTULO_STATUS, ROTULO_TIPO } from "@/lib/feedback/apps";
import { montarMarkdown, nomeAnexo, type ItemExportado } from "@/lib/feedback/exportar";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { AppFeedback, StatusFeedback, TipoFeedback } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mesmos filtros da tela de gestão; devolve um .zip com feedback.md + anexos/. */
export async function GET(req: Request) {
  if (!(await podeGerirFeedback())) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });

  const p = new URL(req.url).searchParams;
  const app = ORDEM_APPS.includes(p.get("app") as AppFeedback) ? (p.get("app") as AppFeedback) : undefined;
  const t = p.get("tipo");
  const tipo = t === "suporte" || t === "sugestao" ? (t as TipoFeedback) : undefined;
  const s = p.get("status") ?? "pendentes";
  const status: StatusFeedback | StatusFeedback[] | undefined =
    s === "todos" ? undefined : s in ROTULO_STATUS ? (s as StatusFeedback) : STATUS_PENDENTES;

  const linhas = await listarFeedbackGestao({ app, tipo, status });
  // Do mais antigo ao mais novo: lê-se como uma fila de trabalho.
  linhas.reverse();

  const admin = criarClienteAdmin();
  const arquivos: Record<string, Uint8Array> = {};
  const itens: ItemExportado[] = [];

  for (const [i, f] of linhas.entries()) {
    const anexos: ItemExportado["anexos"] = [];
    let falhos = 0;
    for (const [j, caminho] of f.anexos.entries()) {
      const { data, error } = await admin.storage.from("feedback-anexos").download(caminho);
      if (error || !data) {
        falhos++;
        continue;
      }
      const arquivo = nomeAnexo(i + 1, f.app, j, caminho);
      arquivos[`anexos/${arquivo}`] = new Uint8Array(await data.arrayBuffer());
      anexos.push({ caminho, arquivo });
    }
    const { anexosUrl: _u, ...item } = f;
    void _u;
    itens.push({ item, anexos, anexosFalhos: falhos });
  }

  const filtrosTexto = [
    `app: ${app ? APPS_FEEDBACK[app].nome : "todos"}`,
    `tipo: ${tipo ? ROTULO_TIPO[tipo] : "todos"}`,
    `status: ${s === "pendentes" ? "pendentes (novo + em análise)" : s}`,
  ].join(", ");
  arquivos["feedback.md"] = strToU8(montarMarkdown(itens, filtrosTexto));

  // Imagens já são comprimidas: ZIP sem recompressão (nível 0) é mais rápido.
  const zip = zipSync(arquivos, { level: 0 });
  const dia = new Date().toISOString().slice(0, 10);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="feedback-${dia}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
