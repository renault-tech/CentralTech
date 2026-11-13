"use client";

import * as React from "react";
import { ChevronDown, CircleDashed, Minus } from "lucide-react";

import { desfazerFase, justificarPendencia, removerJustificativa, salvarFase, type Resultado } from "@/lib/emendas/actions";
import { motivoBloqueioConclusao, type FaseCalculada } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Pendencia } from "@/lib/emendas/pendencias";
import { MarcaEstado } from "@/components/emendas/ui";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";
import { dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import { JanelaFicha } from "@/components/modulo/janela-ficha";
import { montarFicha, urlOriginal, type ContextoFicha, type DocumentoDrive, type DocumentoExigido } from "@/lib/emendas/documentos-drive";
import type { SituacaoFase } from "@/types/emendas";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const BOTAO_PRIMARIO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";
const BOTAO_SECUNDARIO =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50";

const NOME_SITUACAO: Record<SituacaoFase, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  nao_se_aplica: "Não se aplica",
};

const ONDE_EDITAR: Record<string, string> = {
  loa: "Data de aprovação da LOA, em Configurações › Exercício",
  parecer: "Parecer da secretaria, em Configurações › Exequibilidade",
  empenho: "Aba Financeiro",
  liquidacao: "Aba Financeiro",
  pagamento: "Aba Financeiro",
  termo: "Bloco Parceria / execução",
  extrato: "Bloco Parceria / execução",
};

/** Bolinha da fase. Verde com V = concluída; amarela vazada com V = parcial (ainda há saldo);
 * triângulo amarelo vazado com ! = alerta; o resumo aparece ao passar o mouse. */
function Marca({ f }: { f: FaseCalculada }) {
  const resumo = [f.resumo, ...f.alertas.map((a) => `⚠ ${a}`)].join("\n");
  let corpo: React.ReactNode;
  if (f.alertas.length > 0) corpo = <MarcaEstado estado="alerta" />;
  else if (f.situacao === "concluida" && !f.parcial) corpo = <MarcaEstado estado="completo" />;
  else if (f.parcial) corpo = <MarcaEstado estado="parcial" />;
  else if (f.situacao === "em_andamento") corpo = <MarcaEstado estado="parcial" />;
  else if (f.situacao === "nao_se_aplica") corpo = <Minus className="h-5 w-5 text-slate-400" aria-hidden />;
  else corpo = <CircleDashed className="h-5 w-5 text-slate-400" aria-hidden />;
  return (
    <span title={resumo} aria-label={resumo.replace(/\n/g, " — ")} role="img" className="cursor-default">
      {corpo}
    </span>
  );
}

/** Cor da linha que sai da fase: verde se concluída, amarela entre fases parciais, cinza no resto. */
function corDaLinha(f: FaseCalculada, proxima: FaseCalculada | undefined, cor: string): string {
  const emAndamento = (x: FaseCalculada) => x.parcial || x.alertas.length > 0 || x.situacao === "em_andamento";
  if (f.situacao === "concluida" && !f.parcial && f.alertas.length === 0) return cor;
  // Amarela enquanto a fase está parcial/com alerta e a seguinte já andou; cinza quando a seguinte nem começou.
  if (emAndamento(f) && proxima && (emAndamento(proxima) || proxima.situacao === "concluida")) return "#F59E0B";
  return "#E2E8F0";
}

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ fases

/** Números do processo do Compras ligado à emenda, oferecidos como atalho no campo "Documento". */
export type AtalhosCompras = { processo: string | null; licitacao: string | null; contrato: string | null };

const DICAS_FASE: Record<string, { texto: string; sugere: ("processo" | "licitacao" | "contrato")[] }> = {
  processo: {
    texto:
      "Basta informar se o processo de compra ou licitação foi iniciado e se foi concluído; o andamento detalhado (cotação, edital, sessão…) fica no Compras. Ligando o processo acima, esta fase se preenche sozinha.",
    sugere: ["processo", "licitacao", "contrato"],
  },
};

export function AbaFases({
  emendaId,
  fases,
  podeEditar,
  gestor,
  cor,
  atalhos,
  executar,
}: {
  emendaId: string;
  fases: FaseCalculada[];
  gestor: boolean;
  podeEditar: boolean;
  cor: string;
  atalhos?: AtalhosCompras;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
}) {
  const [aberta, setAberta] = React.useState<string | null>(null);
  return (
    <ol className="flex flex-col">
      {fases.map((f, i) => {
        const manual = !f.fase.derivacao;
        const rotulo = f.origem === "presumida" ? "presumida pela etapa atual" : f.origem === "derivada" ? (f.fase.derivacao ? "vem do cadastro" : "vem do processo no Compras") : null;
        return (
          <li key={f.fase.chave} className="grid grid-cols-[24px_1fr] gap-3">
            <span className="flex flex-col items-center" aria-hidden>
              <Marca f={f} />
              {i < fases.length - 1 && <span className="min-h-5 w-0.5 flex-1" style={{ backgroundColor: corDaLinha(f, fases[i + 1], cor) }} />}
            </span>
            <div className="pb-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <strong className={cn("text-sm", f.situacao === "nao_se_aplica" ? "text-slate-500 line-through" : "text-cataguases-marinho")}>{f.fase.nome}</strong>
                {DICAS_FASE[f.fase.chave] && <DicaAjuda rotulo={`Como preencher: ${f.fase.nome}`} texto={DICAS_FASE[f.fase.chave].texto} />}
                <span className="text-xs text-slate-600">{f.parcial ? "Parcial" : NOME_SITUACAO[f.situacao]}</span>
                {f.data && <span className="text-xs tabular-nums text-slate-600">{dataBr(f.data)}</span>}
                {f.documento && <span className="font-mono text-xs text-slate-600">{f.documento}</span>}
                {rotulo && <span className="text-xs italic text-slate-500">{rotulo}</span>}
                {manual && podeEditar && (
                  <button
                    type="button"
                    onClick={() => setAberta(aberta === f.fase.chave ? null : f.fase.chave)}
                    aria-expanded={aberta === f.fase.chave}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#5B3FA8] hover:underline"
                  >
                    Atualizar <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberta === f.fase.chave && "rotate-180")} aria-hidden />
                  </button>
                )}
              </div>
              {f.fase.referencia && <p className="text-xs text-slate-500">Base legal: {f.fase.referencia}</p>}
              {f.observacao && <p className="mt-0.5 text-[13px] text-slate-600">{f.observacao}</p>}
              {!manual && f.fase.derivacao && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Preencha em: <span className="font-medium text-slate-700">{ONDE_EDITAR[f.fase.derivacao]}</span>
                </p>
              )}
              {manual && aberta === f.fase.chave && (
                <EditorFase emendaId={emendaId} fase={f} atalhos={atalhos} gestor={gestor} bloqueioConclusao={f.fase.etapa === "concluida" ? motivoBloqueioConclusao(fases) : null} executar={executar} aoFechar={() => setAberta(null)} />
              )}
            </div>
          </li>
        );
      })}
      {fases.length === 0 && <li className="text-sm text-slate-500">Nenhuma fase cadastrada para este tipo de execução.</li>}
    </ol>
  );
}

const NOME_ATALHO = { processo: "Processo", licitacao: "Licitação", contrato: "Contrato" } as const;

function EditorFase({
  emendaId,
  fase,
  atalhos,
  gestor,
  bloqueioConclusao,
  executar,
  aoFechar,
}: {
  emendaId: string;
  gestor: boolean;
  /** Motivo pelo qual esta fase (Encerramento) ainda não pode ser concluída. */
  bloqueioConclusao: string | null;
  fase: FaseCalculada;
  atalhos?: AtalhosCompras;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
  aoFechar: () => void;
}) {
  const [situacao, setSituacao] = React.useState<SituacaoFase>(fase.origem === "manual" ? fase.situacao : bloqueioConclusao ? "em_andamento" : "concluida");
  const [data, setData] = React.useState(fase.data ?? (fase.situacao === "concluida" ? "" : hojeLocal()));
  const [documento, setDocumento] = React.useState(fase.documento ?? "");
  const [observacao, setObservacao] = React.useState(fase.observacao ?? "");
  const [pendente, iniciar] = React.useTransition();
  const [erro, setErro] = React.useState<string | null>(null);
  const informaData = situacao === "concluida" || situacao === "em_andamento";
  const dica = DICAS_FASE[fase.fase.chave];
  const opcoes = dica && atalhos ? dica.sugere.flatMap((k) => (atalhos[k] ? [[k, atalhos[k] as string] as const] : [])) : [];

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await executar(() =>
        salvarFase({ emendaId, chave: fase.fase.chave, situacao, data: informaData && data ? data : null, documento, observacao })
      );
      if (r.sucesso) aoFechar();
      else setErro(r.erro);
    });
  }

  return (
    <div className="mt-2 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Situação
        <select className={CAMPO} value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoFase)}>
          {(Object.keys(NOME_SITUACAO) as SituacaoFase[]).map((s) => (
            <option key={s} value={s} disabled={s === "concluida" && !!bloqueioConclusao}>
              {NOME_SITUACAO[s]}
              {s === "concluida" && bloqueioConclusao ? " — indisponível" : ""}
            </option>
          ))}
        </select>
      </label>
      {bloqueioConclusao && <p className="text-xs text-slate-600 sm:col-span-2">{bloqueioConclusao}</p>}
      {informaData && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Data
          <input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          {dica ? "Nº do processo ou documento" : "Documento (nº, protocolo)"}
          {dica && <DicaAjuda rotulo="Como preencher" texto={dica.texto} />}
        </span>
        <input className={CAMPO} value={documento} maxLength={120} onChange={(e) => setDocumento(e.target.value)} />
        {opcoes.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5 font-normal">
            <span className="text-slate-500">Do Compras:</span>
            {opcoes.map(([k, v]) => (
              <button key={k} type="button" onClick={() => setDocumento(v)} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-cataguases-marinho hover:border-[#6B4FBB] hover:text-[#5B3FA8]">
                {NOME_ATALHO[k]} {v}
              </button>
            ))}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Observação
        <textarea className={CAMPO} rows={2} value={observacao} maxLength={2000} onChange={(e) => setObservacao(e.target.value)} />
      </label>
      {gestor && fase.origem !== "nenhuma" && fase.situacao !== "pendente" && (
        <div className="sm:col-span-2">
          <button
            type="button"
            disabled={pendente}
            className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
            onClick={() => {
              if (!window.confirm(`Voltar a fase “${fase.fase.nome}” para pendente? A data, o documento e a conclusão dela serão apagados.`)) return;
              setErro(null);
              iniciar(async () => {
                const r = await executar(() => desfazerFase({ emendaId, chave: fase.fase.chave }));
                if (r.sucesso) aoFechar();
                else setErro(r.erro);
              });
            }}
          >
            Anular preenchimento e voltar a fase para pendente
          </button>
        </div>
      )}
      {erro && (
        <p className="text-sm text-red-700 sm:col-span-2" role="alert">
          {erro}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" className={BOTAO_PRIMARIO} onClick={salvar} disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar} disabled={pendente}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------ documentos (por lei)

/**
 * Documentos que a LEI exige para a emenda (só os de parceria e publicação; execução direta não tem). O estado
 * vem do Drive: se o arquivo está ligado à emenda, aparece "Disponível" com o olho (ficha) e o link do original;
 * se não, "Pendente". Nada é marcado à mão, então a lista nunca discorda dos arquivos.
 */
export function AbaDocumentacao({
  exigidos,
  docsDrive,
  contexto,
  tipoRotulo,
}: {
  exigidos: DocumentoExigido[];
  docsDrive: DocumentoDrive[];
  contexto: ContextoFicha;
  tipoRotulo: string;
}) {
  if (exigidos.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        {tipoRotulo}: a lei não exige termo de fomento, plano de trabalho ou extrato para este tipo de execução. Os documentos próprios da compra ficam no processo ligado na aba Fases.
      </p>
    );
  }
  const disponiveis = exigidos.filter((e) => docsDrive.some((d) => d.tipo === e.tipo)).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        <strong className="tabular-nums text-cataguases-marinho">
          {disponiveis}/{exigidos.length}
        </strong>{" "}
        documentos exigidos por lei disponíveis
      </p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {exigidos.map((e) => {
          const docs = docsDrive.filter((d) => d.tipo === e.tipo);
          return (
            <li key={e.tipo} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center">{docs.length ? <MarcaEstado estado="completo" /> : <CircleDashed className="h-5 w-5 text-slate-400" aria-hidden />}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-cataguases-marinho">{e.rotulo}</p>
                <p className="text-xs text-slate-500">Base legal: {e.base}</p>
              </div>
              {docs.length === 0 ? (
                <span className="text-xs text-slate-600">Pendente</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-1.5">
                      <JanelaFicha rotuloTipo={e.rotulo} ficha={montarFicha(d, contexto)} driveFileId={d.drive_file_id} versao={d.drive_versao} />
                      <a href={urlOriginal(d.drive_file_id)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#5B3FA8] hover:underline">
                        Ver original
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- pendências

const COR_GRAVIDADE = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" } as const;

export function AbaPendencias({
  emendaId,
  pendencias,
  podeEditar,
  executar,
  irParaAba,
}: {
  emendaId: string;
  pendencias: Pendencia[];
  podeEditar: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
  irParaAba: (aba: Pendencia["aba"]) => void;
}) {
  const [justificando, setJustificando] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  if (pendencias.length === 0) return <p className="text-sm text-slate-600">Nenhuma pendência nesta emenda.</p>;

  function justificar(p: Pendencia) {
    setErro(null);
    iniciar(async () => {
      const r = await executar(() => justificarPendencia({ emendaId, regra: p.regra, assinatura: p.assinatura, justificativa: texto }));
      if (r.sucesso) {
        setJustificando(null);
        setTexto("");
      } else setErro(r.erro);
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {pendencias.map((p) => (
        <li key={p.regra} className={cn("rounded-lg border border-slate-200 p-3.5", p.justificativa && "bg-slate-50")} style={{ borderLeft: `4px solid ${COR_GRAVIDADE[p.gravidade]}` }}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <strong className="text-sm text-cataguases-marinho">{p.titulo}</strong>
            <span className="text-xs font-medium" style={{ color: COR_GRAVIDADE[p.gravidade] }}>
              {NOME_GRAVIDADE[p.gravidade]}
            </span>
            <button type="button" onClick={() => irParaAba(p.aba)} className="ml-auto text-xs font-medium text-[#5B3FA8] hover:underline">
              Ir resolver
            </button>
          </div>
          <p className="mt-1 text-[13px] text-slate-700">{p.detalhe}</p>
          {p.base && <p className="mt-0.5 text-xs text-slate-500">Base legal: {p.base}</p>}
          {p.justificativa ? (
            <p className="mt-2 text-xs text-slate-600">
              <strong>Justificada:</strong> {p.justificativa}
              {podeEditar && (
                <button
                  type="button"
                  className="ml-2 text-[#5B3FA8] hover:underline"
                  onClick={() => executar(() => removerJustificativa(emendaId, p.regra))}
                >
                  Reabrir
                </button>
              )}
            </p>
          ) : (
            podeEditar &&
            (justificando === p.regra ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea className={CAMPO} rows={2} maxLength={1000} placeholder="Por que isto não precisa de ação agora?" value={texto} onChange={(e) => setTexto(e.target.value)} />
                {erro && (
                  <p className="text-sm text-red-700" role="alert">
                    {erro}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" className={BOTAO_PRIMARIO} disabled={pendente} onClick={() => justificar(p)}>
                    Justificar
                  </button>
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setJustificando(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="mt-2 text-xs font-medium text-slate-600 hover:underline" onClick={() => { setJustificando(p.regra); setTexto(""); setErro(null); }}>
                Justificar e silenciar
              </button>
            ))
          )}
        </li>
      ))}
    </ul>
  );
}
