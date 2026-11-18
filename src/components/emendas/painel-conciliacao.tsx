"use client";

import * as React from "react";
import { AlertTriangle, ArrowDownToLine, CheckCircle2, CircleDashed, Clock, Scale, Undo2 } from "lucide-react";

import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { desfazerConciliacao, salvarConciliacao } from "@/lib/emendas/actions";
import { situacaoConciliacao, type Conciliacao } from "@/lib/emendas/conciliacao";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Resultado } from "@/lib/emendas/actions";

type Executar = (acao: () => Promise<Resultado>) => Promise<Resultado>;
type Sit = ReturnType<typeof situacaoConciliacao>;

/** Altura de toque de 44 px no celular e compacta no computador (padrão dos módulos). */
const ALVO = "min-h-11 sm:min-h-9";
const ROTULO = "flex flex-col gap-1 text-xs font-medium text-slate-700";

function useEnvio(executar: Executar) {
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

/**
 * Conciliação com o IPM (orientação do Controle Interno): o valor contábil fica exato e a diferença é registrada aqui. O painel só
 * aparece quando há o que registrar, e cada bloco só no caso que se aplica: saldo não executado, anulação do saldo do empenho ou
 * excesso sobre o valor da emenda. Cada registro pode ser desfeito pelo gestor.
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
  executar: Executar;
}) {
  const sit = situacaoConciliacao({ valor, empenhado, pago, etapa }, conciliacao);
  const { pendente, erro, enviar } = useEnvio(executar);
  const falta = Math.round((valor - empenhado) * 100) / 100;

  if (!sit.mostrar) {
    // Discreto: só o gestor vê, e só quando há empenho e sobra valor da emenda sem empenhar (ex.: o empenho foi encerrado com saldo).
    if (!gestor || empenhado <= 0.005 || falta <= 0.005) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>Empenho encerrado com saldo da emenda sem empenhar ({brl(falta)})?</span>
        <button type="button" className={cn("cursor-pointer underline underline-offset-2 hover:text-slate-900 focus-visible:rounded", ALVO, "inline-flex items-center")} disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, registrarSaldo: true, encerrarEmpenho: true }))}>
          Registrar como saldo não executado
        </button>
        {erro && <span role="alert" className="text-red-700">{erro}</span>}
      </div>
    );
  }

  const aResolver = (sit.saldoNaoExecutado > 0 && !sit.saldoRegistrado ? 1 : 0) + (sit.saldoEmpenho > 0 ? 1 : 0) + (sit.excesso > 0 && !sit.fonteExcessoInformada ? 1 : 0);
  const diferenca = Math.round((valor - empenhado) * 100) / 100;

  return (
    <section aria-label="Conciliação com o IPM" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#6B4FBB]/10 text-[#5B3FA8]" aria-hidden>
            <Scale className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-cataguases-marinho">Conciliação com o IPM</h3>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-slate-600">
              Empenhado e pago ficam com o valor contábil exato, sem arredondamento. A diferença para o valor da emenda é registrada aqui.
            </p>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", aResolver ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-800")}>
          {aResolver ? <Clock className="h-3.5 w-3.5" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
          {aResolver ? `${aResolver} a resolver` : "Tudo registrado"}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Valores da emenda">
          {[
            ["Valor da emenda", brl(valor), "text-cataguases-marinho"],
            ["Empenhado", brl(empenhado), "text-cataguases-marinho"],
            ["Pago", brl(pago), "text-cataguases-marinho"],
            [diferenca >= 0 ? "Sem empenhar" : "Acima da emenda", brl(Math.abs(diferenca)), diferenca < -0.005 ? "text-red-700" : diferenca > 0.005 ? "text-amber-800" : "text-slate-500"],
          ].map(([k, v, cor]) => (
            <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-[11px] text-slate-500">{k}</dt>
              <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", cor)}>{v}</dd>
            </div>
          ))}
        </dl>

        {(sit.saldoNaoExecutado > 0 || conciliacao?.saldo_registrado_em) && <BlocoSaldo emendaId={emendaId} sit={sit} c={conciliacao} gestor={gestor} executar={executar} />}
        {(sit.saldoEmpenho > 0 || conciliacao?.anulacao_solicitada_em) && (
          <BlocoAnulacao emendaId={emendaId} sit={sit} saldoEmpenho={Math.round((empenhado - pago) * 100) / 100} c={conciliacao} gestor={gestor} executar={executar} />
        )}
        {(sit.excesso > 0 || sit.fonteExcessoInformada) && <BlocoExcesso emendaId={emendaId} sit={sit} c={conciliacao} gestor={gestor} executar={executar} />}
      </div>
    </section>
  );
}

type Tom = "ok" | "atencao" | "alerta" | "info";
const TOM: Record<Tom, { borda: string; selo: string }> = {
  ok: { borda: "border-l-green-600", selo: "bg-green-50 text-green-800" },
  atencao: { borda: "border-l-amber-500", selo: "bg-amber-50 text-amber-900" },
  alerta: { borda: "border-l-red-600", selo: "bg-red-50 text-red-800" },
  info: { borda: "border-l-blue-600", selo: "bg-blue-50 text-blue-800" },
};

function Bloco({ tom, titulo, valor, selo, icone, children }: { tom: Tom; titulo: string; valor: string; selo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className={cn("rounded-lg border border-slate-200 border-l-4 p-3.5 sm:p-4", TOM[tom].borda)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-slate-500" aria-hidden>{icone}</span>
          <h4 className="text-sm font-semibold text-cataguases-marinho">{titulo}</h4>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TOM[tom].selo)}>{selo}</span>
        </div>
        <p className="text-base font-semibold tabular-nums text-cataguases-marinho">{valor}</p>
      </div>
      {children}
    </article>
  );
}

function Desfazer({ onClick, pendente, rotulo = "Desfazer registro" }: { onClick: () => void; pendente: boolean; rotulo?: string }) {
  return (
    <button type="button" onClick={() => { if (window.confirm("Desfazer este registro? Ele sai da conciliação e a pendência volta, se ainda houver diferença.")) onClick(); }} disabled={pendente} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50", ALVO)}>
      <Undo2 className="h-3.5 w-3.5" aria-hidden /> {rotulo}
    </button>
  );
}

type PropsBloco = { emendaId: string; sit: Sit; c: Conciliacao | null; gestor: boolean; executar: Executar };

function BlocoSaldo({ emendaId, sit, c, gestor, executar }: PropsBloco) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [obs, setObs] = React.useState(c?.saldo_observacao ?? "");
  const registrado = sit.saldoRegistrado;
  return (
    <Bloco
      tom={registrado ? "ok" : "atencao"}
      titulo="Saldo da emenda não executado"
      valor={brl(sit.saldoNaoExecutado || Number(c?.saldo_valor ?? 0))}
      selo={registrado ? `Registrado em ${dataBr(c?.saldo_registrado_em)}` : "A registrar"}
      icone={registrado ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
    >
      <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-slate-600">
        {registrado ? "Parte do valor da emenda que não foi empenhada, conferida com o IPM." : "Parte do valor da emenda que não foi empenhada. Confira no IPM e registre; o empenhado continua exato."}
      </p>
      {gestor && (
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <label className={cn(ROTULO, "flex-1")}>
            Observação (opcional)
            <input className={CAMPO} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={cn(registrado ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO, ALVO)} disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, registrarSaldo: !registrado || undefined, saldoObservacao: obs }))}>
              {pendente ? "Salvando…" : registrado ? "Salvar observação" : "Registrar saldo conferido com o IPM"}
            </button>
            {c?.saldo_registrado_em && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "saldo" }))} />}
          </div>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </Bloco>
  );
}

function Passo({ n, feito, atual, children }: { n: number; feito: boolean; atual: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={cn("mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold", feito ? "bg-green-600 text-white" : atual ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600")} aria-hidden>
        {feito ? "✓" : n}
      </span>
      <span className={cn("text-xs leading-snug", feito ? "text-slate-500" : "text-slate-700")}>
        <span className="sr-only">{feito ? "Feito: " : atual ? "Agora: " : "Depois: "}</span>
        {children}
      </span>
    </li>
  );
}

function BlocoAnulacao({ emendaId, sit, saldoEmpenho, c, gestor, executar }: PropsBloco & { saldoEmpenho: number }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [data, setData] = React.useState(c?.anulacao_solicitada_em ?? "");
  const [doc, setDoc] = React.useState(c?.anulacao_documento ?? "");
  const solicitada = !!c?.anulacao_solicitada_em;
  const aAnular = sit.saldoEmpenho || saldoEmpenho;
  return (
    <Bloco
      tom={solicitada ? "info" : "atencao"}
      titulo="Anular o saldo do empenho"
      valor={brl(aAnular)}
      selo={solicitada ? `Solicitada em ${dataBr(c?.anulacao_solicitada_em)}` : "A solicitar"}
      icone={<ArrowDownToLine className="h-4 w-4" />}
    >
      <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-slate-600">
        Há empenho não pago ({brl(saldoEmpenho)}). Com a execução encerrada, o saldo deve ser anulado no IPM.
      </p>
      <ol className="mt-2.5 flex flex-col gap-1.5" aria-label="Passos da anulação">
        <Passo n={1} feito={solicitada} atual={!solicitada}>Solicitar a anulação à Contabilidade e registrar abaixo</Passo>
        <Passo n={2} feito={false} atual={solicitada}>A Contabilidade anula o saldo no IPM</Passo>
        <Passo n={3} feito={false} atual={false}>Lançar a <strong>Anulação de empenho</strong> em “Lançar movimento”: este aviso some sozinho</Passo>
      </ol>
      {gestor && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label className={ROTULO}>
            Solicitada em
            <input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className={ROTULO}>
            Documento / nº da anulação
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="ofício, memorando ou nº no IPM" />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={cn(BOTAO_PRIMARIO, ALVO)} disabled={pendente} onClick={() => enviar(() => salvarConciliacao({ emendaId, anulacaoSolicitadaEm: data, anulacaoDocumento: doc }))}>
              {pendente ? "Salvando…" : "Salvar"}
            </button>
            {solicitada && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "anulacao" }))} rotulo="Desfazer" />}
          </div>
        </div>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </Bloco>
  );
}

function BlocoExcesso({ emendaId, sit, c, gestor, executar }: PropsBloco) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [fonte, setFonte] = React.useState(c?.excesso_fonte ?? "");
  const [doc, setDoc] = React.useState(c?.excesso_documento ?? "");
  const informada = sit.fonteExcessoInformada;
  return (
    <Bloco
      tom={informada ? "ok" : "alerta"}
      titulo="Executado acima do valor da emenda"
      valor={brl(sit.excesso || Number(c?.excesso_valor ?? 0))}
      selo={informada ? "Fonte informada" : "Sem fonte de recurso"}
      icone={informada ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
    >
      <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-slate-600">Informe a fonte de recurso que cobriu o excesso, conforme o IPM.</p>
      {gestor ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className={ROTULO}>
            Fonte de recurso do excesso
            <input className={CAMPO} maxLength={300} value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="ex.: recursos próprios, com a ficha e a fonte do IPM" />
          </label>
          <label className={ROTULO}>
            Documento (opcional)
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={cn(BOTAO_PRIMARIO, ALVO)} disabled={pendente || !fonte.trim()} onClick={() => enviar(() => salvarConciliacao({ emendaId, excessoFonte: fonte, excessoDocumento: doc }))}>
              {pendente ? "Salvando…" : "Salvar fonte"}
            </button>
            {informada && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "excesso" }))} rotulo="Desfazer" />}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-700">Fonte: {c?.excesso_fonte ?? "não informada"}</p>
      )}
      {erro && <p role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </Bloco>
  );
}
