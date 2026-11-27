"use client";

import * as React from "react";
import { CheckCircle2, Undo2 } from "lucide-react";

import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";
import { desfazerConciliacao, desfazerEncerramento, salvarConciliacao, salvarEncerramento } from "@/lib/emendas/actions";
import { vincularDocumentoDrive } from "@/lib/emendas/actions-drive";
import { COR_SITUACAO, documentoComprobatorio, rotuloSituacao, type Encerramento, type SituacaoEncerramento, type TipoExecucaoEnc } from "@/lib/emendas/encerramento";
import { situacaoConciliacao, type Conciliacao } from "@/lib/emendas/conciliacao";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Resultado } from "@/lib/emendas/actions";
import { useDialogos } from "@/components/ui/dialogos";

type Executar = (acao: () => Promise<Resultado>) => Promise<Resultado>;

/** Altura de toque de 44 px no celular e compacta no computador (padrão dos módulos). */
const ALVO = "min-h-9 sm:min-h-7";
const ROTULO = "flex flex-col gap-1 text-xs font-medium text-slate-700";
const SELO = "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium";

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
      <button type="button" onClick={() => setAberta(true)} className={cn(BOTAO_PRIMARIO, ALVO, "w-full justify-center px-2 py-1 text-[0.6875rem] leading-tight")}>
        {rotulo}
      </button>
    );
  return <div data-aberta className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">{children(() => setAberta(false))}</div>;
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
  const { confirmar } = useDialogos();
  return (
    <button
      type="button"
      onClick={async () => {
        if (await confirmar({ titulo: "Desfazer este registro?", mensagem: "Ele sai da conciliação e a pendência volta, se ainda houver diferença.", rotuloConfirmar: "Desfazer", tom: "perigo" })) onClick();
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
    <div className="flex min-w-0 flex-col gap-1 has-[[data-aberta]]:col-span-full">
      <div className="rounded-lg border border-slate-200 px-2 py-1.5">
        <dt className="flex items-center gap-1 text-[0.6875rem] leading-tight text-slate-600">
          {rotulo}
          <DicaAjuda texto={dica} rotulo={`O que é: ${rotulo}`} alinhar={alinhar} />
        </dt>
        <dd className={cn("text-[0.9375rem] font-semibold tabular-nums", cor ?? "text-cataguases-marinho")}>{brl(valor)}</dd>
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
  encerramento,
  tipo,
  provaLigada,
  gestor,
  executar,
}: {
  emendaId: string;
  valor: number;
  empenhado: number;
  pago: number;
  etapa: string;
  conciliacao: Conciliacao | null;
  encerramento: Encerramento | null;
  tipo: TipoExecucaoEnc;
  /** O documento que comprova o cumprimento (nota fiscal ou prestação de contas) já está ligado na Documentação. */
  provaLigada: boolean;
  gestor: boolean;
  executar: Executar;
}) {
  const sit = situacaoConciliacao({ valor, empenhado, pago, etapa }, c);
  const aPagar = Math.max(0, Math.round((empenhado - pago) * 100) / 100);
  const semEmpenhar = Math.round((valor - empenhado) * 100) / 100;
  const acima = semEmpenhar < -0.005;
  const semSaldoPendente = semEmpenhar <= 0.005 && aPagar <= 0.005;
  const form = { emendaId, tipo, provaLigada, gestor, executar, valor, empenhado, pago };
  return (
    <div className="flex flex-col gap-2">
      {encerramento && <FaixaEncerramento enc={encerramento} tipo={tipo} gestor={gestor} emendaId={emendaId} executar={executar} />}
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))] items-start gap-2" aria-label="Valores da emenda">
      <Cartao rotulo="Valor da emenda" valor={valor} alinhar="inicio" dica="Valor total indicado pelo vereador, dentro da cota do exercício." />
      <Cartao rotulo="Empenhado" valor={empenhado} dica="Soma dos empenhos lançados. Fica sempre com o valor exato do IPM, sem arredondamento." />
      <Cartao rotulo="Pago" valor={pago} dica="Soma dos pagamentos lançados (inclui retenções, quando houver).">
        {gestor && !encerramento && semSaldoPendente && empenhado > 0.005 && pago > 0.005 && (
          <Acao rotulo={tipo === "direta" ? "Marcar emenda como cumprida" : "Encerrar a emenda"}>
            {(fechar) => <FormEncerramento {...form} opcoes={tipo === "direta" ? ["cumprida", "nao_cumprida"] : ["cumprida", "cumprida_economia", "nao_cumprida"]} fechar={fechar} />}
          </Acao>
        )}
      </Cartao>
      <Cartao rotulo="A pagar (do empenhado)" valor={aPagar} cor={sit.saldoEmpenho > 0 ? "text-amber-800" : undefined} dica="Empenhado menos pago. Se a execução terminou e ainda sobra empenho sem pagar, o saldo deve ser anulado no IPM.">
        <AcaoAnulacao emendaId={emendaId} sit={sit} valor={sit.saldoEmpenho || aPagar} c={c} gestor={gestor} executar={executar} />
        {gestor && !encerramento && aPagar > 0.005 && (
          <Acao rotulo="Inscrever em restos a pagar">{(fechar) => <FormEncerramento {...form} opcoes={["restos_a_pagar"]} fechar={fechar} />}</Acao>
        )}
      </Cartao>
      {acima ? (
        <Cartao rotulo="Acima da emenda" valor={-semEmpenhar} cor="text-red-700" alinhar="fim" dica="Empenhado maior que o valor da emenda. O excesso só é aceito com a fonte de recurso que o cobriu, conforme o IPM.">
          <AcaoExcesso emendaId={emendaId} sit={sit} c={c} gestor={gestor} executar={executar} />
        </Cartao>
      ) : (
        <Cartao rotulo="Sem empenhar" valor={semEmpenhar} cor={semEmpenhar > 0.005 ? "text-amber-800" : "text-slate-500"} alinhar="fim" dica="Valor da emenda menos o empenhado. Quando a execução termina com sobra, ela é registrada como saldo não executado (conferida com o IPM).">
          <AcaoSaldo sit={sit} c={c} falta={semEmpenhar} empenhado={empenhado} gestor={gestor} semEncerramento={!encerramento} form={form} />
        </Cartao>
      )}
    </dl>
    </div>
  );
}

type Sit = ReturnType<typeof situacaoConciliacao>;

type PropsForm = { emendaId: string; tipo: TipoExecucaoEnc; provaLigada: boolean; gestor: boolean; executar: Executar; valor: number; empenhado: number; pago: number };

function AcaoSaldo({ sit, c, falta, empenhado, gestor, semEncerramento, form }: { sit: Sit; c: Conciliacao | null; falta: number; empenhado: number; gestor: boolean; semEncerramento: boolean; form: PropsForm }) {
  const { pendente, erro, enviar } = useEnvio(form.executar);
  if (sit.saldoRegistrado)
    return (
      <div className="flex flex-col gap-1">
        <span className={cn(SELO, "bg-green-50 text-green-800")}>
          <CheckCircle2 className="h-3 w-3" aria-hidden /> Saldo registrado em {dataBr(c?.saldo_registrado_em)}
        </span>
        {c?.saldo_observacao && <p className="text-xs text-slate-600">“{c.saldo_observacao}”</p>}
        {gestor && semEncerramento && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerConciliacao({ emendaId: form.emendaId, bloco: "saldo" }))} />}
        {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
      </div>
    );
  // O botão só existe quando há empenho e sobra valor da emenda sem empenhar.
  if (!gestor || !semEncerramento || empenhado <= 0.005 || falta <= 0.005) return sit.saldoNaoExecutado > 0 ? <span className={cn(SELO, "bg-amber-50 text-amber-900")}>Saldo a registrar</span> : null;
  return (
    <Acao rotulo="Registrar saldo e situação da emenda">
      {(fechar) => <FormEncerramento {...form} opcoes={["cumprida_economia", "nao_cumprida"]} fechar={fechar} />}
    </Acao>
  );
}

const DESCRICAO_SITUACAO: Record<SituacaoEncerramento, (tipo: TipoExecucaoEnc) => string> = {
  cumprida: () => "O objeto foi entregue integralmente.",
  cumprida_economia: (tipo) => (tipo === "direta" ? "O objeto foi entregue gastando menos. A parte não empenhada volta ao caixa da Prefeitura e a emenda conta como cumprida." : "A entidade cumpriu o objeto e devolveu o saldo que não gastou."),
  nao_cumprida: () => "O objeto não foi entregue (impedimento ou desistência).",
  restos_a_pagar: () => "O empenho não pago passa para o exercício seguinte. Só vale para valor já empenhado.",
};

/** Janela de encerramento: situação, comprovante (nota fiscal ou prestação de contas), devolução no repasse e observação. */
function FormEncerramento({ emendaId, tipo, provaLigada, executar, opcoes, fechar }: PropsForm & { opcoes: SituacaoEncerramento[]; fechar: () => void }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const [situacao, setSituacao] = React.useState<SituacaoEncerramento>(opcoes[0]);
  const [obs, setObs] = React.useState("");
  const [link, setLink] = React.useState("");
  const [dev, setDev] = React.useState("");
  const [devData, setDevData] = React.useState("");
  const [devDoc, setDevDoc] = React.useState("");
  const prova = documentoComprobatorio(tipo);
  const exigeProva = situacao === "cumprida" || situacao === "cumprida_economia";
  const comDevolucao = situacao === "cumprida_economia" && tipo !== "direta";
  const devNum = Number(dev.replace(/\./g, "").replace(",", "."));

  function confirmar() {
    enviar(async () => {
      if (exigeProva && !provaLigada) {
        if (!link.trim()) return { sucesso: false as const, erro: `Cole o link do documento: ${prova.rotulo.toLowerCase()}.` };
        const r = await vincularDocumentoDrive({ emendaId, tipo: prova.tipo, link });
        if (!r.sucesso) return r;
      }
      return salvarEncerramento({ emendaId, situacao, observacao: obs, devolucaoValor: comDevolucao && dev ? devNum : null, devolucaoData: comDevolucao && dev ? devData : null, devolucaoDocumento: comDevolucao ? devDoc : undefined });
    }, fechar);
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={pendente}>
      <legend className="sr-only">Situação da emenda</legend>
      {opcoes.length > 1 &&
        opcoes.map((o) => (
          <label key={o} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs has-[:checked]:border-[#6B4FBB] has-[:checked]:bg-[#6B4FBB]/5">
            <input type="radio" name={`sit-${emendaId}`} checked={situacao === o} onChange={() => setSituacao(o)} className="mt-0.5" />
            <span>
              <span className="font-medium text-slate-800">{rotuloSituacao(o, tipo)}</span>
              <span className="block text-slate-600">{DESCRICAO_SITUACAO[o](tipo)}</span>
            </span>
          </label>
        ))}
      {opcoes.length === 1 && <p className="text-xs text-slate-600">{DESCRICAO_SITUACAO[situacao](tipo)}</p>}
      {exigeProva &&
        (provaLigada ? (
          <p className="flex items-center gap-1 text-xs text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {prova.rotulo}: já ligado na Documentação.
          </p>
        ) : (
          <label className={ROTULO}>
            {prova.rotulo} (obrigatório)
            <input className={CAMPO} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Cole o link do arquivo no Drive" />
          </label>
        ))}
      {comDevolucao && (
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-2">
          <p className="text-xs font-medium text-slate-700">Devolução de saldo pela entidade (se houve)</p>
          <label className={ROTULO}>
            Valor devolvido (R$)
            <input className={CAMPO} inputMode="decimal" value={dev} onChange={(e) => setDev(e.target.value)} placeholder="0,00" />
          </label>
          {dev && (
            <>
              <label className={ROTULO}>
                Data da devolução
                <input type="date" className={CAMPO} value={devData} onChange={(e) => setDevData(e.target.value)} />
              </label>
              <label className={ROTULO}>
                Comprovante / nº (opcional)
                <input className={CAMPO} maxLength={200} value={devDoc} onChange={(e) => setDevDoc(e.target.value)} />
              </label>
            </>
          )}
        </div>
      )}
      <label className={ROTULO}>
        Justificativa (opcional)
        <textarea className={CAMPO} rows={2} maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      <Botoes pendente={pendente} fechar={fechar} confirmar={confirmar} desabilitar={comDevolucao && !!dev && (!(devNum > 0) || !devData)} />
      {erro && <p role="alert" className="text-xs text-red-700">{erro}</p>}
    </fieldset>
  );
}

/** Faixa com a situação já definida (selo, data, devolução e justificativa), com "Desfazer" para o gestor. */
function FaixaEncerramento({ enc, tipo, gestor, emendaId, executar }: { enc: Encerramento; tipo: TipoExecucaoEnc; gestor: boolean; emendaId: string; executar: Executar }) {
  const { pendente, erro, enviar } = useEnvio(executar);
  const dev = Number(enc.devolucao_valor ?? 0);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className={cn(SELO, COR_SITUACAO[enc.situacao].selo)}>{rotuloSituacao(enc.situacao, tipo)}</span>
      <span className="text-xs text-slate-600">definida em {dataBr(enc.definida_em)}</span>
      {dev > 0 && <span className="text-xs text-slate-700">Devolução de {brl(dev)} em {dataBr(enc.devolucao_data)}{enc.devolucao_documento ? ` · ${enc.devolucao_documento}` : ""}</span>}
      {enc.observacao && <span className="text-xs text-slate-600">“{enc.observacao}”</span>}
      {gestor && <Desfazer pendente={pendente} onClick={() => enviar(() => desfazerEncerramento({ emendaId }))} />}
      {erro && <p role="alert" className="basis-full text-xs text-red-700">{erro}</p>}
    </div>
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
