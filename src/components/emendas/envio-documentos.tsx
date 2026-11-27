"use client";

import * as React from "react";
import { CheckCircle2, Clock3, FileUp, Undo2 } from "lucide-react";

import { DicaAjuda } from "@/components/emendas/dica-ajuda";
import { concluirEnvioDocumento, iniciarEnvioDocumento } from "@/lib/emendas/actions-envio";
import { ROTULO_DRIVE, TIPOS_DRIVE_PUBLICOS, type TipoDrive } from "@/lib/emendas/documentos-drive";
import { dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Resultado } from "@/lib/emendas/actions";
import type { DocumentoEnviadoRow } from "@/types/emendas";

const BOTAO = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#6B4FBB] px-3.5 py-1 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";

const SELO: Record<DocumentoEnviadoRow["status"], { texto: string; classe: string }> = {
  aguardando: { texto: "Aguardando", classe: "bg-amber-50 text-amber-900" },
  aprovado: { texto: "Aprovado", classe: "bg-emerald-50 text-emerald-900" },
  devolvido: { texto: "Devolvido", classe: "bg-red-50 text-red-800" },
};

/** Envia o PDF direto do navegador para o Drive (com barra de progresso) e depois registra o envio. */
function enviarParaGoogle(url: string, arquivo: File, aoProgresso: (pct: number) => void): Promise<string> {
  return new Promise((ok, erro) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", arquivo.type || "application/pdf");
    x.upload.onprogress = (e) => e.lengthComputable && aoProgresso(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => erro(new Error("A conexão com o Drive falhou durante o envio."));
    x.onload = () => {
      if (x.status < 200 || x.status >= 300) return erro(new Error("O Drive não aceitou o arquivo."));
      try {
        const id = (JSON.parse(x.responseText) as { id?: string }).id;
        if (id) ok(id);
        else erro(new Error("O Drive não devolveu o arquivo enviado."));
      } catch {
        erro(new Error("Resposta inesperada do Drive."));
      }
    };
    x.send(arquivo);
  });
}

export function EnvioDocumentos({
  emendaId,
  tipos,
  enviados,
  nomes,
  pode,
  executar,
}: {
  emendaId: string;
  tipos: TipoDrive[];
  enviados: DocumentoEnviadoRow[];
  nomes: Record<string, string>;
  pode: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
}) {
  const [tipo, setTipo] = React.useState<TipoDrive>(tipos[0] ?? "nota_fiscal");
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [progresso, setProgresso] = React.useState<number | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const entrada = React.useRef<HTMLInputElement>(null);
  const publico = (TIPOS_DRIVE_PUBLICOS as readonly string[]).includes(tipo);

  const enviar = async () => {
    if (!arquivo) return;
    setErro(null);
    setProgresso(0);
    try {
      const ini = await iniciarEnvioDocumento({ emendaId, tipo, mime: "application/pdf", tamanho: arquivo.size });
      if (!ini.sucesso) throw new Error(ini.erro);
      const driveFileId = await enviarParaGoogle(ini.urlEnvio, arquivo, setProgresso);
      const r = await executar(() => concluirEnvioDocumento({ emendaId, tipo, driveFileId, nome: ini.nome }));
      if (!r.sucesso) throw new Error(r.erro);
      setArquivo(null);
      if (entrada.current) entrada.current.value = "";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setProgresso(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-medium text-cataguases-marinho">Enviar documento</p>
      {pode && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDrive)} disabled={progresso !== null} className="h-9 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800">
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_DRIVE[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-xs text-slate-500">
            PDF (até 25 MB)
            <input ref={entrada} type="file" accept="application/pdf" disabled={progresso !== null} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-sm" />
          </label>
          <button type="button" className={BOTAO} disabled={!arquivo || progresso !== null} onClick={enviar}>
            <FileUp className="h-4 w-4" aria-hidden /> {progresso !== null ? `Enviando ${progresso}%` : "Enviar"}
          </button>
          <DicaAjuda texto={publico ? "Vai para a pasta privada de originais e espera a análise do gestor (compressão e tarja)." : "Vai para a pasta de internos. O gestor aprova e o documento liga à emenda."} />
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">
          {erro}
        </p>
      )}
      {enviados.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 text-xs">
          {enviados.map((d) => {
            const s = SELO[d.status];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", s.classe)}>
                  {d.status === "aprovado" ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : d.status === "devolvido" ? <Undo2 className="h-3 w-3" aria-hidden /> : <Clock3 className="h-3 w-3" aria-hidden />}
                  {s.texto}
                </span>
                <span className="min-w-0 break-words text-slate-700">{ROTULO_DRIVE[d.tipo]}</span>
                <a href={`/api/documentos/arquivo/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#5B3FA8] hover:underline">
                  Abrir
                </a>
                <span className="text-slate-500">
                  {nomes[d.enviado_por] ?? "—"} · {dataBr(d.enviado_em.slice(0, 10))}
                </span>
                {d.status === "devolvido" && d.motivo && <span className="basis-full text-red-800">Motivo: {d.motivo}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {!pode && enviados.length === 0 && <p className="mt-1 text-xs text-slate-500">Nenhum documento enviado por aqui.</p>}
    </div>
  );
}
