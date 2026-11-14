"use client";

import { Eye, ExternalLink, X } from "lucide-react";
import * as React from "react";

import { idDriveValido, urlOriginal, type Ficha } from "@/lib/emendas/documentos-drive";

/**
 * Janela da "ficha" de um documento: o olho abre os dados principais (montados do cadastro) e o botão
 * "Ver documento original" abre SÓ aquele arquivo no Drive, em outra aba. Usada no módulo Emendas e no
 * portal público. `<dialog>` nativo: Esc fecha, o foco fica preso na janela e volta ao botão.
 */
export function JanelaFicha({
  rotuloTipo,
  ficha,
  driveFileId,
  versao,
  classeBotao,
  rotuloBotao,
  vazio = "Não informado",
}: {
  rotuloTipo: string;
  ficha: Ficha;
  driveFileId: string;
  /** Data da última alteração do arquivo no Drive (quando foi registrado aqui). */
  versao?: string | null;
  classeBotao?: string;
  rotuloBotao?: string;
  vazio?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titulo = React.useId();
  const ok = idDriveValido(driveFileId);

  function abrir() {
    ref.current?.showModal();
  }
  function fechar() {
    ref.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={classeBotao ?? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-cataguases-marinho"}
        aria-label={`Ver ficha: ${rotuloBotao ?? ficha.titulo}`}
        title="Ver ficha do documento"
      >
        <Eye className="h-[18px] w-[18px]" aria-hidden />
        {rotuloBotao && <span className="ml-1.5 text-[13px] font-medium">{rotuloBotao}</span>}
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titulo}
        onClick={(e) => {
          if (e.target === ref.current) fechar();
        }}
        className="m-auto w-[min(640px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-0">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Ficha do documento · {rotuloTipo}</p>
            <h2 id={titulo} className="mt-1 text-xl font-semibold tracking-tight text-cataguases-marinho">
              {ficha.titulo}
            </h2>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar ficha" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
            <X className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>

        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          {ficha.campos.map((c) => {
            const em = c.valor === null || c.valor === "";
            return (
              <div key={c.rotulo} className={c.largo ? "sm:col-span-2" : undefined}>
                <dt className="text-[12px] text-slate-500">{c.rotulo}</dt>
                <dd className={`mt-0.5 text-[14.5px] leading-snug ${em ? "italic text-slate-500" : "font-medium text-slate-900"}`}>{em ? vazio : c.valor}</dd>
              </div>
            );
          })}
        </dl>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-5">
          {ok ? (
            <a
              href={urlOriginal(driveFileId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-fit items-center gap-2 rounded-[10px] bg-[#0B5FA8] px-5 text-sm font-medium text-white no-underline hover:bg-[#084A85]"
            >
              <ExternalLink className="h-[18px] w-[18px]" aria-hidden />
              Ver documento original
            </a>
          ) : (
            <p className="text-sm text-slate-500">Link do original indisponível.</p>
          )}
          <p className="text-[12px] leading-relaxed text-slate-500">
            O original abre em outra aba, a partir do arquivo da Prefeitura{versao ? ` (versão de ${new Date(versao).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})` : ""}. Dados pessoais (CPF, RG e endereço de pessoas físicas) são retirados da versão pública. Base legal: {ficha.base}.
          </p>
        </div>
      </dialog>
    </>
  );
}
