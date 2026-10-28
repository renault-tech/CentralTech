"use client";

import * as React from "react";
import { Check, ChevronDown, CircleDashed, CircleDot, Minus } from "lucide-react";

import { justificarPendencia, removerJustificativa, salvarFase, salvarItemChecklist, type Resultado } from "@/lib/emendas/actions";
import type { FaseCalculada } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Pendencia } from "@/lib/emendas/pendencias";
import { DicaAjuda } from "@/components/emendas/dica-ajuda";
import { dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { ChecklistEmenda, EstadoChecklist, ItemChecklist, SituacaoFase } from "@/types/emendas";

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

function Marca({ situacao, presumida }: { situacao: SituacaoFase; presumida?: boolean }) {
  if (situacao === "concluida")
    return (
      <span
        className={cn("flex h-5 w-5 items-center justify-center rounded-full", presumida ? "border border-emerald-600 text-emerald-700" : "bg-emerald-600 text-white")}
      >
        <Check className="h-3 w-3" aria-hidden />
      </span>
    );
  if (situacao === "em_andamento") return <CircleDot className="h-5 w-5 text-amber-600" aria-hidden />;
  if (situacao === "nao_se_aplica") return <Minus className="h-5 w-5 text-slate-400" aria-hidden />;
  return <CircleDashed className="h-5 w-5 text-slate-400" aria-hidden />;
}

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ fases

/** Números do processo do Compras ligado à emenda, oferecidos como atalho no campo "Documento". */
export type AtalhosCompras = { processo: string | null; licitacao: string | null; contrato: string | null };

const DICAS_FASE: Record<string, { texto: string; sugere: ("processo" | "licitacao" | "contrato")[] }> = {
  demanda: {
    texto:
      "DFD, ETP e Termo de Referência são documentos DENTRO do processo do Compras: não têm numeração própria no sistema. Informe o nº do processo (ex.: 2026/0062); o vínculo é feito em “Processo no Compras”, ao lado.",
    sugere: ["processo"],
  },
  precos: {
    texto:
      "A pesquisa de preços também fica no mesmo processo. Informe o nº do processo (ex.: 2026/0062) ou, se a pesquisa tiver protocolo ou mapa próprio, esse número.",
    sugere: ["processo"],
  },
  contratacao: {
    texto:
      "É o processo de licitação, dispensa ou inexigibilidade. É o MESMO processo do Compras: ao seguir para o setor de Licitação ele ganha o 2º número (ex.: 136/2026). Informe o nº da licitação.",
    sugere: ["licitacao", "processo"],
  },
  instrumento: {
    texto:
      "Contrato, ata de registro de preços ou autorização de fornecimento. Informe o nº do instrumento (ex.: contrato 045/2026); o Compras guarda o contrato vinculado ao processo.",
    sugere: ["contrato", "licitacao"],
  },
};

export function AbaFases({
  emendaId,
  fases,
  podeEditar,
  cor,
  atalhos,
  executar,
}: {
  emendaId: string;
  fases: FaseCalculada[];
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
        const rotulo = f.origem === "presumida" ? "presumida pela etapa atual" : f.origem === "derivada" ? "vem do cadastro" : null;
        return (
          <li key={f.fase.chave} className="grid grid-cols-[24px_1fr] gap-3">
            <span className="flex flex-col items-center" aria-hidden>
              <Marca situacao={f.situacao} presumida={f.origem === "presumida"} />
              {i < fases.length - 1 && <span className="min-h-5 w-0.5 flex-1" style={{ backgroundColor: f.situacao === "concluida" ? cor : "#E2E8F0" }} />}
            </span>
            <div className="pb-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <strong className={cn("text-sm", f.situacao === "nao_se_aplica" ? "text-slate-500 line-through" : "text-cataguases-marinho")}>{f.fase.nome}</strong>
                {DICAS_FASE[f.fase.chave] && <DicaAjuda rotulo={`Como preencher: ${f.fase.nome}`} texto={DICAS_FASE[f.fase.chave].texto} />}
                <span className="text-xs text-slate-600">{NOME_SITUACAO[f.situacao]}</span>
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
              {f.fase.referencia && <p className="text-xs text-slate-500">{f.fase.referencia}</p>}
              {f.observacao && <p className="mt-0.5 text-[13px] text-slate-600">{f.observacao}</p>}
              {!manual && f.fase.derivacao && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Preencha em: <span className="font-medium text-slate-700">{ONDE_EDITAR[f.fase.derivacao]}</span>
                </p>
              )}
              {manual && aberta === f.fase.chave && (
                <EditorFase emendaId={emendaId} fase={f} atalhos={atalhos} executar={executar} aoFechar={() => setAberta(null)} />
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
  executar,
  aoFechar,
}: {
  emendaId: string;
  fase: FaseCalculada;
  atalhos?: AtalhosCompras;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
  aoFechar: () => void;
}) {
  const [situacao, setSituacao] = React.useState<SituacaoFase>(fase.origem === "manual" ? fase.situacao : "concluida");
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
            <option key={s} value={s}>
              {NOME_SITUACAO[s]}
            </option>
          ))}
        </select>
      </label>
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

// -------------------------------------------------------------- checklist

const NOME_ESTADO: Record<EstadoChecklist, string> = {
  conferido: "Conferido",
  presumido: "Presumido",
  pendente: "Pendente",
  nao_se_aplica: "Não se aplica",
};

export function AbaDocumentacao({
  emendaId,
  itens,
  registros,
  podeEditar,
  executar,
}: {
  emendaId: string;
  itens: ItemChecklist[];
  registros: ChecklistEmenda[];
  podeEditar: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
}) {
  const porChave = new Map(registros.map((r) => [r.item_chave, r]));
  const aplicaveis = itens.filter((i) => porChave.get(i.chave)?.estado !== "nao_se_aplica");
  const conferidos = aplicaveis.filter((i) => porChave.get(i.chave)?.estado === "conferido").length;
  const [salvando, setSalvando] = React.useState<string | null>(null);

  async function mudar(chave: string, estado: EstadoChecklist) {
    setSalvando(chave);
    await executar(() => salvarItemChecklist({ emendaId, itemChave: chave, estado, observacao: porChave.get(chave)?.observacao ?? "" }));
    setSalvando(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        <strong className="tabular-nums text-cataguases-marinho">
          {conferidos}/{aplicaveis.length}
        </strong>{" "}
        documentos conferidos
        {itens.length === 0 && " — nenhum item cadastrado para este tipo."}
      </p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {itens.map((i) => {
          const estado = porChave.get(i.chave)?.estado ?? "pendente";
          return (
            <li key={i.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#6B4FBB]"
                aria-label={`${i.nome}: conferido`}
                checked={estado === "conferido"}
                disabled={!podeEditar || salvando === i.chave}
                onChange={(e) => mudar(i.chave, e.target.checked ? "conferido" : "pendente")}
              />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", estado === "nao_se_aplica" ? "text-slate-500 line-through" : "text-cataguases-marinho")}>{i.nome}</p>
                {i.referencia_legal && <p className="text-xs text-slate-500">{i.referencia_legal}</p>}
              </div>
              {podeEditar ? (
                <select
                  className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-700"
                  aria-label={`Estado de ${i.nome}`}
                  value={estado}
                  disabled={salvando === i.chave}
                  onChange={(e) => mudar(i.chave, e.target.value as EstadoChecklist)}
                >
                  {estado === "presumido" && <option value="presumido">{NOME_ESTADO.presumido}</option>}
                  <option value="pendente">{NOME_ESTADO.pendente}</option>
                  <option value="conferido">{NOME_ESTADO.conferido}</option>
                  <option value="nao_se_aplica">{NOME_ESTADO.nao_se_aplica}</option>
                </select>
              ) : (
                <span className="text-xs text-slate-600">{NOME_ESTADO[estado]}</span>
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
