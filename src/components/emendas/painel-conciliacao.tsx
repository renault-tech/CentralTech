"use client";

import * as React from "react";
import { Scale } from "lucide-react";

import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { salvarConciliacao } from "@/lib/emendas/actions";
import { situacaoConciliacao, type Conciliacao } from "@/lib/emendas/conciliacao";
import { brl, dataBr } from "@/lib/emendas/regras";
import type { Resultado } from "@/lib/emendas/actions";

/**
 * Conciliação com o IPM (orientação do Controle Interno): o valor contábil fica exato e a diferença é registrada aqui. O painel
 * só aparece quando há o que registrar — saldo não executado, saldo do empenho a anular ou excesso sobre o valor da emenda —,
 * e cada bloco só aparece no caso que se aplica.
 */
export function PainelConciliacao({
  emendaId,
  valor,
  empenhado,
  pago,
  etapa,
  conciliacao,
  gestor,
  executar,
}: {
  emendaId: string;
  valor: number;
  empenhado: number;
  pago: number;
  etapa: string;
  conciliacao: Conciliacao | null;
  gestor: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
}) {
  const sit = situacaoConciliacao({ valor, empenhado, pago, etapa }, conciliacao);
  const { pendente, erro, enviar } = useEnvio(executar);
  const falta = Math.round((valor - empenhado) * 100) / 100;
  if (!sit.mostrar) {
    // Discreto: só o gestor vê, e só quando há empenho e sobra valor da emenda sem empenhar (ex.: o empenho foi encerrado com saldo).
    if (!gestor || empenhado <= 0.005 || falta <= 0.005) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Empenho encerrado com saldo da emenda sem empenhar ({brl(falta)})?</span>
        <button type="button" className="underline hover:text-slate-900" disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, registrarSaldo: true, encerrarEmpenho: true }))}>
          Registrar como saldo não executado
        </button>
        {erro && <span role="alert" className="text-red-700">{erro}</span>}
      </div>
    );
  }
  const rotulo = "flex flex-col gap-1 text-xs font-medium text-slate-700";
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Conciliação com o IPM">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-cataguases-marinho">
          <Scale className="h-4 w-4" aria-hidden /> Conciliação com o IPM
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Empenhado e pago ficam com o valor contábil exato, sem arredondamento. A diferença para o valor da emenda é registrada aqui (orientação do Controle Interno).
        </p>
      </div>

      {(sit.saldoNaoExecutado > 0 || conciliacao?.saldo_registrado_em) && (
        <BlocoSaldo emendaId={emendaId} sit={sit} c={conciliacao} gestor={gestor} executar={executar} rotulo={rotulo} />
      )}
      {(sit.saldoEmpenho > 0 || conciliacao?.anulacao_solicitada_em) && (
        <BlocoAnulacao emendaId={emendaId} sit={sit} saldoEmpenho={Math.round((empenhado - pago) * 100) / 100} c={conciliacao} gestor={gestor} executar={executar} rotulo={rotulo} />
      )}
      {(sit.excesso > 0 || sit.fonteExcessoInformada) && (
        <BlocoExcesso emendaId={emendaId} sit={sit} c={conciliacao} gestor={gestor} executar={executar} rotulo={rotulo} />
      )}
    </section>
  );
}

type Props = {
  emendaId: string;
  sit: ReturnType<typeof situacaoConciliacao>;
  c: Conciliacao | null;
  gestor: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
  rotulo: string;
};

function useEnvio(executar: Props["executar"]) {
  const [pendente, iniciar] = React.useTransition();
  const [erro, setErro] = React.useState<string | null>(null);
  const enviar = (acao: () => Promise<Resultado>) =>
    iniciar(async () => {
      setErro(null);
      const r = await executar(acao);
      if (!r.sucesso) setErro(r.erro);
    });
  return { pendente, erro, enviar };
}

function BlocoSaldo({ emendaId, sit, c, gestor, executar, rotulo }: Props) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [obs, setObs] = React.useState(c?.saldo_observacao ?? "");
  const registrado = sit.saldoRegistrado;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-medium text-cataguases-marinho">
        Saldo da emenda não executado: <span className="tabular-nums">{brl(sit.saldoNaoExecutado || Number(c?.saldo_valor ?? 0))}</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        {registrado
          ? `Registrado em ${dataBr(c?.saldo_registrado_em)} como saldo não executado.`
          : "Parte do valor da emenda que não foi empenhada. Confira no IPM e registre o saldo (o empenhado continua exato)."}
      </p>
      {gestor && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className={`${rotulo} min-w-[16rem] flex-1`}>
            Observação (opcional)
            <input className={CAMPO} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <button type="button" className={registrado ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO} disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, registrarSaldo: !registrado || undefined, saldoObservacao: obs }))}>
            {pendente ? "Salvando…" : registrado ? "Salvar observação" : "Registrar saldo conferido com o IPM"}
          </button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}

function BlocoAnulacao({ emendaId, sit, saldoEmpenho, c, gestor, executar, rotulo }: Props & { saldoEmpenho: number }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [data, setData] = React.useState(c?.anulacao_solicitada_em ?? "");
  const [doc, setDoc] = React.useState(c?.anulacao_documento ?? "");
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-medium text-cataguases-marinho">
        Anulação do saldo do empenho: <span className="tabular-nums">{brl(sit.saldoEmpenho || saldoEmpenho)}</span> a anular no IPM
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        Há empenho não pago ({brl(saldoEmpenho)}). Com a execução encerrada, a Contabilidade anula o saldo no IPM; depois de feita, lance a <strong>Anulação de empenho</strong> em “Lançar movimento” e este aviso some sozinho.
      </p>
      {gestor && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className={rotulo}>
            Solicitada à Contabilidade em
            <input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className={`${rotulo} min-w-[14rem] flex-1`}>
            Documento / nº da anulação
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="ofício, memorando ou nº no IPM" />
          </label>
          <button type="button" className={BOTAO_PRIMARIO} disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, anulacaoSolicitadaEm: data, anulacaoDocumento: doc }))}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}

function BlocoExcesso({ emendaId, sit, c, gestor, executar, rotulo }: Props) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [fonte, setFonte] = React.useState(c?.excesso_fonte ?? "");
  const [doc, setDoc] = React.useState(c?.excesso_documento ?? "");
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-sm font-medium text-amber-900">
        Executado acima do valor da emenda: <span className="tabular-nums">{brl(sit.excesso || Number(c?.excesso_valor ?? 0))}</span>
      </p>
      <p className="mt-0.5 text-xs text-amber-900/90">Informe a fonte de recurso que cobriu o excesso (verificada no IPM).</p>
      {gestor ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className={`${rotulo} min-w-[16rem] flex-1`}>
            Fonte de recurso do excesso
            <input className={CAMPO} maxLength={300} value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="ex.: recursos próprios — ficha e fonte do IPM" />
          </label>
          <label className={`${rotulo} min-w-[12rem]`}>
            Documento (opcional)
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} />
          </label>
          <button type="button" className={BOTAO_PRIMARIO} disabled={pendente || !fonte.trim()} onClick={() => enviar(() => salvarConciliacao({ emendaId, excessoFonte: fonte, excessoDocumento: doc }))}>
            {pendente ? "Salvando…" : "Salvar fonte"}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-700">Fonte: {c?.excesso_fonte ?? "não informada"}</p>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </div>
  );
}
