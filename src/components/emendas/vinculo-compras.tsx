"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { vincularProcesso } from "@/lib/emendas/actions";
import type { ProcessoCompras } from "@/lib/emendas/compras";
import { dataBr } from "@/lib/emendas/regras";
import { CampoProcesso } from "@/components/emendas/campo-processo";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";

const NOME_STATUS: Record<string, string> = { em_andamento: "Em andamento", concluido: "Concluído", suspenso: "Suspenso", cancelado: "Cancelado" };

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
        Processo no Compras
        <DicaAjuda
          rotulo="Como funciona o vínculo com o Compras"
          texto={
            <>
              Cada compra tem <strong>um processo só</strong> no Compras, com dois números: o do <strong>processo</strong> (ex.: 2026/0062, nasce no setor de
              Compras) e o da <strong>licitação</strong> (ex.: 136/2026, dado quando segue para o setor de Licitação). É o mesmo processo: ligue uma vez aqui e as
              fases DFD/ETP/TR, pesquisa de preços, contratação e contrato usam este vínculo. Digite o número (ou parte dele) ou uma palavra do objeto.
              {" "}Troca de processo feita por quem não é gestor vai para aprovação.
            </>
          }
        />
      </h2>
      {processo ? (
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <div>
            <dt className="text-xs text-slate-500">Processo{processo.numero_licitacao ? " · Licitação" : ""}</dt>
            <dd className="font-medium text-cataguases-marinho">
              {processo.numero}
              {processo.numero_licitacao ? ` · ${processo.numero_licitacao}` : ""}
            </dd>
          </div>
          <p className="text-slate-700">{processo.objeto}</p>
          <p className="text-xs text-slate-600">
            {NOME_STATUS[processo.status] ?? processo.status}
            {processo.modalidade ? ` · ${processo.modalidade}` : ""}
            {processo.setor ? ` · no setor ${processo.setor}` : ""}
          </p>
          {(processo.data_publicacao || processo.data_sessao) && (
            <p className="text-xs text-slate-600">
              {processo.data_publicacao ? `Publicado em ${dataBr(processo.data_publicacao)}` : ""}
              {processo.data_publicacao && processo.data_sessao ? " · " : ""}
              {processo.data_sessao ? `Sessão em ${dataBr(processo.data_sessao)}` : ""}
            </p>
          )}
          {processo.contrato_vinculado && <p className="text-xs text-slate-600">Contrato: {processo.contrato_vinculado}</p>}
          <a
            href={`/sso/silencioso?app=compras&proximo=${encodeURIComponent(`/processos?processo=${processo.id}`)}`}
            target="_blank"
            rel="noopener"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#5B3FA8] hover:underline"
          >
            Abrir no Compras <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </dl>
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
