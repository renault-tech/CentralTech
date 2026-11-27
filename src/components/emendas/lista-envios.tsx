"use client";

import * as React from "react";
import Link from "next/link";

import { useDialogos } from "@/components/ui/dialogos";
import { decidirDocumentoEnviado } from "@/lib/emendas/actions-envio";
import type { EnvioListado } from "@/lib/emendas/dados-envios";
import { ROTULO_DRIVE } from "@/lib/emendas/documentos-drive";
import { dataBr } from "@/lib/emendas/regras";

const BOTAO = "inline-flex min-h-9 items-center rounded-lg bg-[#6B4FBB] px-3.5 py-1 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";
const BOTAO_2 = "inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50";

/** Documentos enviados pelas secretarias, esperando decisão. Só o gestor decide; os demais veem o andamento dos próprios. */
export function ListaEnvios({ envios, gestor }: { envios: EnvioListado[]; gestor: boolean }) {
  const { pedirTexto, avisar } = useDialogos();
  const [pendente, iniciar] = React.useTransition();
  if (envios.length === 0) return null;

  const decidir = (id: string, decisao: "aprovar" | "devolver", motivo?: string) =>
    iniciar(async () => {
      const r = await decidirDocumentoEnviado({ id, decisao, motivo });
      if (!r.sucesso) await avisar({ titulo: "Não foi possível decidir", mensagem: r.erro });
    });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-cataguases-marinho">Documentos enviados ({envios.length})</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {envios.map((e) => {
          const publico = e.pasta === "originais";
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
              <div className="min-w-0 flex-1 basis-64">
                <p className="break-words text-slate-800">
                  {ROTULO_DRIVE[e.tipo]} ·{" "}
                  <Link href={`/emendas/${e.emenda_id}`} className="font-medium text-[#5B3FA8] hover:underline">
                    emenda nº {e.emenda_numero ?? "—"}
                  </Link>
                </p>
                <p className="text-xs text-slate-500">
                  {e.autor_nome ?? "—"} · {dataBr(e.enviado_em.slice(0, 10))}
                  {publico ? " · pasta de originais (privada)" : " · pasta de internos"}
                </p>
              </div>
              <a href={`/api/documentos/arquivo/${e.id}`} target="_blank" rel="noopener noreferrer" className={BOTAO_2}>
                Abrir
              </a>
              {gestor && (
                <>
                  {publico ? (
                    <span className="max-w-[16rem] text-xs text-slate-500">Análise com compressão e tarja: próxima etapa.</span>
                  ) : (
                    <button type="button" className={BOTAO} disabled={pendente} onClick={() => decidir(e.id, "aprovar")}>
                      Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    className={BOTAO_2}
                    disabled={pendente}
                    onClick={async () => {
                      const motivo = await pedirTexto({ titulo: "Devolver o documento", mensagem: "Diga o que precisa ser corrigido.", rotuloConfirmar: "Devolver", minimo: 5, multilinha: true });
                      if (motivo) decidir(e.id, "devolver", motivo);
                    }}
                  >
                    Devolver
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
