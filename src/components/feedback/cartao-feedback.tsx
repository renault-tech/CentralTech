import { FileText } from "lucide-react";

import { AcoesFeedback } from "@/components/feedback/acoes-feedback";
import { APPS_FEEDBACK, ROTULO_STATUS, ROTULO_TIPO } from "@/lib/feedback/apps";
import type { FeedbackComAnexos } from "@/lib/dados/feedback";

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

const ehImagem = (c: string) => /\.(png|jpe?g|webp|gif)$/i.test(c);

/** Etiqueta do app, na cor de identidade dele (texto escuro sobre fundo claro da mesma cor). */
export function EtiquetaApp({ app }: { app: FeedbackComAnexos["app"] }) {
  const a = APPS_FEEDBACK[app];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: a.corTexto, borderColor: `${a.cor}55`, backgroundColor: `${a.cor}14` }}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />
      {a.nome}
    </span>
  );
}

/** `gerir` mostra autor e botões de status; sem ele é a visão "meus envios". */
export function CartaoFeedback({ item, gerir }: { item: FeedbackComAnexos; gerir: boolean }) {
  const cor = APPS_FEEDBACK[item.app].cor;
  return (
    <div
      className="rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3.5 shadow-sm sm:px-5"
      style={{ borderLeftColor: cor }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <EtiquetaApp app={item.app} />
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{ROTULO_TIPO[item.tipo]}</span>
        {gerir && <span className="font-medium text-slate-700">{item.autor_nome}</span>}
        <span>{dataHora(item.criado_em)}</span>
        {gerir && item.pagina && <span className="truncate">· {item.pagina}</span>}
        <span className="ml-auto rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {ROTULO_STATUS[item.status]}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{item.mensagem}</p>
      {item.anexosUrl.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.anexos.map((c, i) => {
            const url = item.anexosUrl[i];
            if (!url) return null;
            return ehImagem(c) ? (
              <a key={c} href={url} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-md border border-slate-200">
                {/* URL assinada que expira — next/image não se aplica. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Anexo do feedback" className="h-full w-full object-cover" />
              </a>
            ) : (
              <a key={c} href={url} target="_blank" rel="noreferrer" className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100">
                <FileText className="h-5 w-5" aria-hidden />
                <span className="text-[10px]">Arquivo</span>
              </a>
            );
          })}
        </div>
      )}
      {gerir && (
        <div className="mt-3">
          <AcoesFeedback id={item.id} status={item.status} />
        </div>
      )}
    </div>
  );
}
