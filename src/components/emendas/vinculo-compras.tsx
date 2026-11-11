"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { vincularProcesso } from "@/lib/emendas/actions";
import type { ProcessoCompras } from "@/lib/emendas/compras";
import { CampoProcesso } from "@/components/emendas/campo-processo";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";

/** Processo do Compras ligado à emenda: digita o número uma vez, o resto vem de lá. */
export function VinculoCompras({
  emendaId,
  processo,
  numeroLivre,
  podeEditar,
}: {
  emendaId: string;
  processo: ProcessoCompras | null;
  /** Número antigo digitado à mão (campo "processo licitatório"), ainda sem vínculo. */
  numeroLivre: string | null;
  podeEditar: boolean;
}) {
  const [numero, setNumero] = React.useState(processo ? "" : (numeroLivre ?? ""));
  const [msg, setMsg] = React.useState<{ tom: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();
  // A gestão da emenda só precisa saber se o processo começou e se terminou; o miúdo fica no Compras.
  const situacao = !processo
    ? { texto: "", classe: "" }
    : processo.status === "cancelado"
      ? { texto: "Cancelado", classe: "bg-red-50 text-red-800" }
      : processo.status === "suspenso"
        ? { texto: "Suspenso", classe: "bg-amber-50 text-amber-900" }
        : processo.status === "concluido" || processo.contratos.length > 0
          ? { texto: "Concluído", classe: "bg-green-50 text-green-800" }
          : { texto: "Iniciado", classe: "bg-blue-50 text-blue-800" };

  function salvar(valor: string) {
    setMsg(null);
    iniciar(async () => {
      const r = await vincularProcesso(emendaId, valor);
      if (!r.sucesso) setMsg({ tom: "erro", texto: r.erro });
      else {
        setNumero("");
        if (r.aviso) setMsg({ tom: "ok", texto: r.aviso });
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-cataguases-marinho">
        Processo de compra ou licitação
        <DicaAjuda
          rotulo="Como funciona o vínculo com o Compras"
          texto={
            <>
              Ligue o processo do Compras uma vez, digitando o número (processo, licitação ou parte do objeto). A emenda mostra apenas se o processo foi
              <strong> iniciado</strong> ou <strong>concluído</strong>; o andamento detalhado fica no Compras. Troca feita por quem não é gestor vai para aprovação.
            </>
          }
        />
      </h2>
      {processo ? (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-cataguases-marinho">Processo {processo.numero}</span>
            {processo.numero_licitacao && <span className="text-slate-600">· Licitação {processo.numero_licitacao}</span>}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${situacao.classe}`}>{situacao.texto}</span>
          </p>
          <p className="text-slate-700">{processo.objeto}</p>
          <a
            href={`/sso/silencioso?app=compras&proximo=${encodeURIComponent(`/processos?processo=${processo.id}`)}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#5B3FA8] hover:underline"
          >
            Ver detalhes no Compras <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      ) : (
        <p className="text-[13px] text-slate-600">
          {numeroLivre ? `Número informado: ${numeroLivre} (sem vínculo).` : "Nenhum processo ligado."} Informe o número para trazer os dados do Compras.
        </p>
      )}
      {podeEditar && (
        <div className="mt-3 flex gap-2">
          <CampoProcesso
            emendaId={emendaId}
            valor={numero}
            aoMudar={setNumero}
            aoEscolher={(s) => {
              setNumero(s.numero);
            }}
            desabilitado={pendente}
          />
          <button type="button" disabled={pendente || !numero.trim()} onClick={() => salvar(numero)} className="h-9 rounded-lg bg-[#6B4FBB] px-3 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50">
            {processo ? "Trocar" : "Vincular"}
          </button>
          {processo && (
            <button type="button" disabled={pendente} onClick={() => salvar("")} className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50">
              Desfazer
            </button>
          )}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.tom === "erro" ? "text-red-700" : "text-amber-900"}`} role={msg.tom === "erro" ? "alert" : "status"}>{msg.texto}</p>}
    </section>
  );
}
