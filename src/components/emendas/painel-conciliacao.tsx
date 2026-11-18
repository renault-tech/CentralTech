"use client";

import * as React from "react";
import { CheckCircle2, Undo2 } from "lucide-react";

import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";
import { desfazerConciliacao, salvarConciliacao } from "@/lib/emendas/actions";
import { situacaoConciliacao, type Conciliacao } from "@/lib/emendas/conciliacao";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Resultado } from "@/lib/emendas/actions";

type Executar = (acao: () => Promise<Resultado>) => Promise<Resultado>;

/** Altura de toque de 44 px no celular e compacta no computador (padrão dos módulos). */
const ALVO = "min-h-11 sm:min-h-9";
const ROTULO = "flex flex-col gap-1 text-xs font-medium text-slate-700";
const SELO = "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

function useEnvio(executar: Executar) {
  const [pendente, iniciar] = React.useTransition();
  const [erro, setErro] = React.useState<string | null>(null);
  const enviar = (acao: () => Promise<Resultado>, depois?: () => void) =>
    iniciar(async () => {
      setErro(null);
      const r = await executar(acao);
      if (!r.sucesso) setErro(r.erro);
      else depois?.();
    });
  return { pendente, erro, enviar };
}

/** Botão que só abre o formulário depois do clique. */
function Acao({ rotulo, children }: { rotulo: string; children: (fechar: () => void) => React.ReactNode }) {
  const [aberta, setAberta] = React.useState(false);
  if (!aberta)
    return (
      <button type="button" onClick={() => setAberta(true)} className={cn(BOTAO_PRIMARIO, ALVO, "w-full justify-center text-xs")}>
        {rotulo}
      </button>
    );
  return <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">{children(() => setAberta(false))}</div>;
}

function Botoes({ confirmar, pendente, desabilitar, fechar, rotulo = "Confirmar" }: { confirmar: () => void; pendente: boolean; desabilitar?: boolean; fechar: () => void; rotulo?: string }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" className={cn(BOTAO_PRIMARIO, ALVO, "flex-1 justify-center text-xs")} disabled={pendente || desabilitar} onClick={confirmar}>
        {pendente ? "Salvando…" : rotulo}
      </button>
      <button type="button" className={cn(BOTAO_SECUNDARIO, ALVO, "flex-1 justify-center text-xs")} onClick={fechar} disabled={pendente}>
        Cancelar
      </button>
    </div>
  );
}

function Desfazer({ onClick, pendente }: { onClick: () => void; pendente: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Desfazer este registro? Ele sai da conciliação e a pendência volta, se ainda houver diferença.")) onClick();
      }}
      disabled={pendente}
      className={cn("inline-flex w-fit cursor-pointer items-center gap-1 rounded px-1 text-xs text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50", ALVO)}
    >
      <Undo2 className="h-3 w-3" aria-hidden /> Desfazer
    </button>
  );
}

function Cartao({ rotulo, valor, cor, dica, alinhar, children }: { rotulo: string; valor: number; cor?: string; dica: React.ReactNode; alinhar?: "inicio" | "centro" | "fim"; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="rounded-lg border border-slate-200 px-3 py-2.5">
        <dt className="flex items-center gap-1 text-xs text-slate-600">
          {rotulo}
          <DicaAjuda texto={dica} rotulo={`O que é: ${rotulo}`} alinhar={alinhar} />
        </dt>
        <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", cor ?? "text-cataguases-marinho")}>{brl(valor)}</dd>
      </div>
      {children}
    </div>
  );
}

/**
 * Cartões de valores da aba Financeiro. Cada ação da conciliação com o IPM (orientação do Controle Interno: valor contábil exato, sem
 * arredondamento) é um botão sob o cartão a que se refere e só existe quando aquele valor ocorre; o formulário abre depois do clique.
 */
export function CartoesFinanceiros({
  emendaId,
  valor,
  empenhado,
  pago,
  etapa,
  conciliacao: c,
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
  const sit = situacaoConciliacao({ valor, empenhado, pago, etapa }, c);
  const aPagar = Math.max(0, Math.round((empenhado - pago) * 100) / 100);
  const semEmpenhar = Math.round((valor - empenhado) * 100) / 100;
  const acima = semEmpenhar < -0.005;
  return (
    <dl className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Valores da emenda">
      <Cartao rotulo="Valor da emenda" valor={valor} alinhar="inicio" dica="Valor total indicado pelo vereador, dentro da cota do exercício." />
      <Cartao rotulo="Empenhado" valor={empenhado} dica="Soma dos empenhos lançados. Fica sempre com o valor exato do IPM, sem arredondamento." />
      <Cartao rotulo="Pago" valor={pago} dica="Soma dos pagamentos lançados (inclui retenções, quando houver)." />
      <Cartao rotulo="A pagar (do empenhado)" valor={aPagar} cor={sit.saldoEmpenho > 0 ? "text-amber-800" : undefined} dica="Empenhado menos pago. Se a execução terminou e ainda sobra empenho sem pagar, o saldo deve ser anulado no IPM.">
        <AcaoAnulacao emendaId={emendaId} sit={sit} valor={sit.saldoEmpenho || aPagar} c={c} gestor={gestor} executar={executar} />
      </Cartao>
      {acima ? (
        <Cartao rotulo="Acima da emenda" valor={-semEmpenhar} cor="text-red-700" alinhar="fim" dica="Empenhado maior que o valor da emenda. O excesso só é aceito com a fonte de recurso que o cobriu, conforme o IPM.">
          <AcaoExcesso emendaId={emendaId} sit={sit} c={c} gestor={gestor} executar={executar} />
        </Cartao>
      ) : (
        <Cartao rotulo="Sem empenhar" valor={semEmpenhar} cor={semEmpenhar > 0.005 ? "text-amber-800" : "text-slate-500"} alinhar="fim" dica="Valor da emenda menos o empenhado. Quando a execução termina com sobra, ela é registrada como saldo não executado (conferida com o IPM).">
          <AcaoSaldo emendaId={emendaId} sit={sit} c={c} falta={semEmpenhar} empenhado={empenhado} gestor={gestor} executar={executar} />
        </Cartao>
      )}
    </dl>
  );
}

type Sit = ReturnType<typeof situacaoConciliacao>;

function AcaoSaldo({ emendaId, sit, c, falta, empenhado, gestor, executar }: { emendaId: string; sit: Sit; c: Conciliacao | null; falta: number; empenhado: number; gestor: boolean; executar: Executar }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [obs, setObs] = React.useState(c?.saldo_observacao ?? "");
  if (sit.saldoRegistrado)
    return (
      <div className="flex flex-col gap-1">
        <span className={cn(SELO, "bg-green-50 text-green-800")}>
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Saldo registrado em {dataBr(c?.saldo_registrado_em)}
        </span>
        {c?.saldo_observacao && <p className="text-xs text-slate-600">“{c.saldo_observacao}”</p>}
        {gestor && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "saldo" }))} />}
        {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      </div>
    );
  // Só aparece quando há empenho e sobra valor da emenda sem empenhar.
  if (!gestor || empenhado <= 0.005 || falta <= 0.005) return sit.saldoNaoExecutado > 0 ? <span className={cn(SELO, "bg-amber-50 text-amber-900")}>Saldo a registrar</span> : null;
  const encerrando = sit.saldoNaoExecutado <= 0; // execução ainda em andamento: o gestor encerra o empenho com saldo
  return (
    <Acao rotulo={encerrando ? "Encerrar empenho com saldo" : "Registrar saldo não executado"}>
      {(fechar) => (
        <>
          <label className={ROTULO}>
            Justificativa (opcional)
            <textarea className={CAMPO} rows={2} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: conferido com o IPM" />
          </label>
          <Botoes pendente={pendente} fechar={fechar} confirmar={() => enviar(() => salvarConciliacao({ emendaId, registrarSaldo: true, encerrarEmpenho: encerrando || undefined, saldoObservacao: obs }), fechar)} />
          {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
        </>
      )}
    </Acao>
  );
}

function AcaoAnulacao({ emendaId, sit, valor, c, gestor, executar }: { emendaId: string; sit: Sit; valor: number; c: Conciliacao | null; gestor: boolean; executar: Executar }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [data, setData] = React.useState(c?.anulacao_solicitada_em ?? "");
  const [doc, setDoc] = React.useState(c?.anulacao_documento ?? "");
  const solicitada = !!c?.anulacao_solicitada_em;
  if (sit.saldoEmpenho <= 0 && !solicitada) return null;
  if (solicitada)
    return (
      <div className="flex flex-col gap-1">
        <span className={cn(SELO, "bg-blue-50 text-blue-800")}>Anulação solicitada em {dataBr(c?.anulacao_solicitada_em)}</span>
        {c?.anulacao_documento && <p className="text-xs text-slate-600">{c.anulacao_documento}</p>}
        <p className="text-xs leading-snug text-slate-600">Depois que a Contabilidade anular no IPM, lance a <strong>Anulação de empenho</strong> em “Lançar movimento”: este aviso some sozinho.</p>
        {gestor && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "anulacao" }))} />}
        {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      </div>
    );
  if (!gestor) return <span className={cn(SELO, "bg-amber-50 text-amber-900")}>Anulação a solicitar ({brl(valor)})</span>;
  return (
    <Acao rotulo="Solicitar anulação do saldo">
      {(fechar) => (
        <>
          <label className={ROTULO}>
            Data da solicitação
            <input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className={ROTULO}>
            Nº do ofício / anulação (opcional)
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="ofício ou nº no IPM" />
          </label>
          <Botoes pendente={pendente} fechar={fechar} desabilitar={!data} confirmar={() => enviar(() => salvarConciliacao({ emendaId, anulacaoSolicitadaEm: data, anulacaoDocumento: doc }), fechar)} />
          {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
        </>
      )}
    </Acao>
  );
}

function AcaoExcesso({ emendaId, sit, c, gestor, executar }: { emendaId: string; sit: Sit; c: Conciliacao | null; gestor: boolean; executar: Executar }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [fonte, setFonte] = React.useState(c?.excesso_fonte ?? "");
  const [doc, setDoc] = React.useState(c?.excesso_documento ?? "");
  if (sit.fonteExcessoInformada)
    return (
      <div className="flex flex-col gap-1">
        <span className={cn(SELO, "bg-green-50 text-green-800")}>
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Fonte informada
        </span>
        <p className="text-xs text-slate-600">{c?.excesso_fonte}</p>
        {gestor && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId, bloco: "excesso" }))} />}
        {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      </div>
    );
  if (!gestor) return <span className={cn(SELO, "bg-red-50 text-red-800")}>Sem fonte de recurso</span>;
  return (
    <Acao rotulo="Informar fonte do excesso">
      {(fechar) => (
        <>
          <label className={ROTULO}>
            Fonte de recurso
            <input className={CAMPO} maxLength={300} value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="ficha e fonte, conforme o IPM" />
          </label>
          <label className={ROTULO}>
            Documento (opcional)
            <input className={CAMPO} maxLength={200} value={doc} onChange={(e) => setDoc(e.target.value)} />
          </label>
          <Botoes pendente={pendente} fechar={fechar} desabilitar={!fonte.trim()} rotulo="Salvar fonte" confirmar={() => enviar(() => salvarConciliacao({ emendaId, excessoFonte: fonte, excessoDocumento: doc }), fechar)} />
          {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
        </>
      )}
    </Acao>
  );
}
