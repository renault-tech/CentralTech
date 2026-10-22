"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { salvarExecucao } from "@/lib/emendas/actions";
import { dataBr, situacaoVigencia } from "@/lib/emendas/regras";
import type { ExecucaoEmenda, Modalidade } from "@/types/emendas";

type Campos = {
  numeroTermo: string;
  processoLicitatorio: string;
  dataEnvioPagamento: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  dataPublicacaoExtrato: string;
  contaBancaria: string;
  gestorOsc: string;
  gestorPmc: string;
  observacao: string;
};

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function paraCampos(x: ExecucaoEmenda | null): Campos {
  return {
    numeroTermo: x?.numero_termo ?? "",
    processoLicitatorio: x?.processo_licitatorio ?? "",
    dataEnvioPagamento: x?.data_envio_pagamento ?? "",
    vigenciaInicio: x?.vigencia_inicio ?? "",
    vigenciaFim: x?.vigencia_fim ?? "",
    dataPublicacaoExtrato: x?.data_publicacao_extrato ?? "",
    contaBancaria: x?.conta_bancaria ?? "",
    gestorOsc: x?.gestor_osc ?? "",
    gestorPmc: x?.gestor_pmc ?? "",
    observacao: x?.observacao ?? "",
  };
}

/**
 * Parceria e execução: termo, vigência (cronograma), extrato, envio para
 * pagamento, conta e gestores — os dados da planilha de cumprimento. Edita quem
 * registra a execução da emenda (a RLS de `emendas.execucao` decide).
 */
export function PainelParceria({
  emendaId,
  modalidade,
  execucao,
  podeEditar,
}: {
  emendaId: string;
  modalidade: Modalidade;
  execucao: ExecucaoEmenda | null;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = React.useState(false);
  const repasse = modalidade === "repasse";
  const vigencia = situacaoVigencia(execucao?.vigencia_fim, hojeLocal());
  const semExtrato = repasse && !!execucao?.numero_termo && !execucao.data_publicacao_extrato;

  const linhas: [string, string | null][] = repasse
    ? [
        ["Termo de parceria", execucao?.numero_termo ? `nº ${execucao.numero_termo}` : null],
        [
          "Vigência (cronograma de execução)",
          execucao?.vigencia_inicio || execucao?.vigencia_fim ? `${dataBr(execucao?.vigencia_inicio)} a ${dataBr(execucao?.vigencia_fim)}` : null,
        ],
        ["Publicação do extrato", execucao?.data_publicacao_extrato ? dataBr(execucao.data_publicacao_extrato) : null],
        ["Envio para pagamento", execucao?.data_envio_pagamento ? dataBr(execucao.data_envio_pagamento) : null],
        ["Conta bancária da entidade", execucao?.conta_bancaria ?? null],
        ["Gestor da parceria na entidade", execucao?.gestor_osc ?? null],
        ["Gestor da parceria na Prefeitura", execucao?.gestor_pmc ?? null],
      ]
    : [
        ["Processo licitatório", execucao?.processo_licitatorio ?? null],
        ["Envio para pagamento", execucao?.data_envio_pagamento ? dataBr(execucao.data_envio_pagamento) : null],
        ["Gestor na Prefeitura", execucao?.gestor_pmc ?? null],
      ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-cataguases-marinho">{repasse ? "Parceria e execução" : "Execução"}</h2>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#6B4FBB] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
          </button>
        )}
      </div>

      {(vigencia?.alerta || semExtrato) && (
        <ul className="mb-3 flex flex-col gap-1.5">
          {vigencia?.alerta && (
            <li className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden /> {vigencia.texto}
            </li>
          )}
          {semExtrato && (
            <li className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden /> Extrato do termo ainda sem data de publicação
            </li>
          )}
        </ul>
      )}

      <dl className="flex flex-col gap-2.5 text-[13px]">
        {linhas.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="mt-0.5 break-words font-medium text-cataguases-marinho">{v || "—"}</dd>
          </div>
        ))}
        {vigencia && !vigencia.alerta && <p className="text-xs text-slate-500">{vigencia.texto}</p>}
        {execucao?.observacao && (
          <div>
            <dt className="text-xs text-slate-500">Observação</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-700">{execucao.observacao}</dd>
          </div>
        )}
      </dl>

      {podeEditar && editando && (
        <DialogoParceria
          aberto
          aoFechar={() => setEditando(false)}
          emendaId={emendaId}
          repasse={repasse}
          inicial={paraCampos(execucao)}
        />
      )}
    </section>
  );
}

function DialogoParceria({
  aberto,
  aoFechar,
  emendaId,
  repasse,
  inicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  emendaId: string;
  repasse: boolean;
  inicial: Campos;
}) {
  const router = useRouter();
  // Montado só enquanto aberto: reabre sempre com o que está salvo.
  const [c, setC] = React.useState(inicial);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const campo = (k: keyof Campos) => ({
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC((v) => ({ ...v, [k]: e.target.value })),
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const r = await salvarExecucao({ emendaId, ...c });
    setEnviando(false);
    if (!r.sucesso) return setErro(r.erro);
    aoFechar();
    router.refresh();
  }

  const rotulo = "flex flex-col gap-1.5 text-[13px] font-medium text-cataguases-marinho";
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{repasse ? "Parceria e execução" : "Execução"}</DialogTitle>
          <DialogDescription>
            Dados do acompanhamento. As fases (termo, empenho, envio para pagamento, pagamento) continuam sendo registradas como andamento.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 flex flex-col gap-3.5" onSubmit={salvar}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {repasse ? (
              <>
                <label className={rotulo}>
                  Nº do termo de parceria
                  <input className={CAMPO} maxLength={40} placeholder="027/2026" {...campo("numeroTermo")} />
                </label>
                <label className={rotulo}>
                  Publicação do extrato
                  <input type="date" className={CAMPO} {...campo("dataPublicacaoExtrato")} />
                </label>
                <label className={rotulo}>
                  Início da vigência
                  <input type="date" className={CAMPO} {...campo("vigenciaInicio")} />
                </label>
                <label className={rotulo}>
                  Fim da vigência
                  <input type="date" className={CAMPO} {...campo("vigenciaFim")} />
                </label>
              </>
            ) : (
              <label className={`${rotulo} sm:col-span-2`}>
                Processo licitatório
                <input className={CAMPO} maxLength={200} {...campo("processoLicitatorio")} />
              </label>
            )}
            <label className={rotulo}>
              Envio para pagamento
              <input type="date" className={CAMPO} {...campo("dataEnvioPagamento")} />
            </label>
            <label className={rotulo}>
              Gestor na Prefeitura
              <input className={CAMPO} maxLength={200} {...campo("gestorPmc")} />
            </label>
            {repasse && (
              <>
                <label className={rotulo}>
                  Gestor na entidade
                  <input className={CAMPO} maxLength={200} {...campo("gestorOsc")} />
                </label>
                <label className={rotulo}>
                  Conta bancária da entidade
                  <input className={CAMPO} maxLength={200} {...campo("contaBancaria")} />
                </label>
              </>
            )}
            <label className={`${rotulo} sm:col-span-2`}>
              Observação
              <textarea className={CAMPO} rows={3} maxLength={2000} {...campo("observacao")} />
            </label>
          </div>
          {erro && (
            <p className="text-sm text-red-700" role="alert">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar}>
              Cancelar
            </button>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
