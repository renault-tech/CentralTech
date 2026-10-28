"use client";

import * as React from "react";
import Link from "next/link";

import { importarJsonV1, type ResumoImportacao } from "@/lib/emendas/actions-propostas";

/** Importa o JSON exportado do controle em HTML. Nada é gravado direto: tudo vira proposta. */
export function ImportadorJson() {
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [resultado, setResultado] = React.useState<ResumoImportacao | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function enviar() {
    if (!arquivo) return;
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    setResultado(null);
    iniciar(async () => setResultado(await importarJsonV1(fd)));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-[15px] font-semibold text-cataguases-marinho">Importar o controle de execução (JSON)</h2>
      <p className="mt-1 max-w-3xl text-[13px] text-slate-600">
        Arquivo exportado pelo HTML de controle (formato <code>centraltech.emendas.execucao/v1</code>): termo, vigência, extrato, conta, gestores, fases e checklist.
        Nada é gravado direto: cada diferença vira uma proposta para você aprovar. Campo vazio no arquivo nunca apaga dado do sistema.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input type="file" accept=".json,application/json" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setResultado(null); }} className="text-sm" />
        <button type="button" disabled={!arquivo || pendente} onClick={enviar} className="inline-flex h-9 items-center rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50">
          {pendente ? "Analisando…" : "Gerar propostas"}
        </button>
      </div>
      {resultado && !resultado.sucesso && <p className="mt-3 text-sm text-red-700" role="alert">{resultado.erro}</p>}
      {resultado?.sucesso && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">
          {resultado.propostas} proposta(s) em {resultado.emendasAfetadas} emenda(s); {resultado.semMudanca} emenda(s) sem diferença
          {resultado.emendasIgnoradas.length > 0 && `; ${resultado.emendasIgnoradas.length} do arquivo não existem no sistema`}.{" "}
          <Link href="/emendas/aprovacoes" className="font-medium underline">Revisar e aprovar</Link>
        </div>
      )}
    </section>
  );
}
