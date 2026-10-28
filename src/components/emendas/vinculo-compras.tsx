"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

import { vincularProcesso } from "@/lib/emendas/actions";
import type { ProcessoCompras } from "@/lib/emendas/compras";
import { dataBr } from "@/lib/emendas/regras";
import { CampoProcesso } from "@/components/emendas/campo-processo";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";

function Numero({ rotulo, valor, vazio, uso, extra }: { rotulo: string; valor: string | null; vazio?: string; uso: string; extra?: (string | null | false | undefined)[] }) {
  const detalhes = (extra ?? []).filter(Boolean).join(" · ");
  return (
    <div className="px-3 py-2">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className={valor ? "font-medium text-cataguases-marinho" : "text-xs italic text-slate-500"}>{valor ?? vazio ?? "—"}</dd>
      {detalhes && <dd className="text-xs text-slate-600">{detalhes}</dd>}
      <dd className="text-[11px] text-slate-400">Vale para: {uso}</dd>
    </div>
  );
}

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
              Cada compra é <strong>um processo só</strong> no Compras, mas ganha um número em cada setor: o <strong>processo</strong> (ex.: 2026/0062,
              setor de Compras), a <strong>licitação</strong> (ex.: 136/2026, ao ir para Licitação) e o <strong>contrato</strong> (setor de Contratos). Ligue uma vez
              aqui: cada número abaixo diz em qual fase da emenda ele é usado. Digite o número (ou parte dele) ou uma palavra do objeto.
              {" "}Troca de processo feita por quem não é gestor vai para aprovação.
            </>
          }
        />
      </h2>
      {processo ? (
        <dl className="flex flex-col gap-2 text-[13px]">
          <p className="text-slate-700">{processo.objeto}</p>
          <p className="text-xs text-slate-600">
            {NOME_STATUS[processo.status] ?? processo.status}
            {processo.modalidade ? ` · ${processo.modalidade}` : ""}
            {processo.setor ? ` · no setor ${processo.setor}` : ""}
          </p>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            <Numero
              rotulo="Processo (Compras)"
              valor={processo.numero}
              uso="Fases DFD, ETP e TR e pesquisa de preços"
            />
            <Numero
              rotulo="Licitação"
              valor={processo.numero_licitacao}
              vazio="ainda não chegou ao setor de Licitação"
              uso="Fase processo de contratação"
              extra={[processo.data_publicacao && `publicado ${dataBr(processo.data_publicacao)}`, processo.data_sessao && `sessão ${dataBr(processo.data_sessao)}`]}
            />
            {processo.contratos.length > 0 ? (
              processo.contratos.map((c) => (
                <Numero
                  key={c.numero}
                  rotulo="Contrato"
                  valor={c.numero}
                  uso="Fase contrato, ata ou autorização de fornecimento"
                  extra={[c.tipo, c.credor, c.data_vencimento && `vence ${dataBr(c.data_vencimento)}`]}
                />
              ))
            ) : (
              <Numero rotulo="Contrato" valor={processo.contrato_vinculado} vazio="ainda sem contrato cadastrado no setor de Contratos" uso="Fase contrato, ata ou autorização de fornecimento" />
            )}
          </div>
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
