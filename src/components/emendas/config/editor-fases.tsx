"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";

import { salvarFluxo } from "@/lib/emendas/actions-config";
import type { UsoEtapa } from "@/lib/emendas/dados";
import { ETAPAS_FIXAS, NOME_MODALIDADE, validarFluxo, type CatalogoEtapas } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Modalidade } from "@/types/emendas";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB] disabled:bg-slate-50";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";
const BOTAO_ICONE =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30";

const COR_NOVA = "#BBAAEE";

type Linha = {
  /** Identificador local (a chave do banco só existe depois de salvar). */
  id: string;
  chave: string | null;
  nome: string;
  cor: string;
  ativa: boolean;
  fixa: boolean;
  removida: boolean;
};

function linhasIniciais(cat: CatalogoEtapas, modalidade: Modalidade): Linha[] {
  return cat.fluxos[modalidade].map((i) => {
    const e = cat.etapas[i.chave];
    return {
      id: i.chave,
      chave: i.chave,
      nome: e?.nome ?? i.chave,
      cor: e?.cor ?? COR_NOVA,
      ativa: i.ativa,
      fixa: ETAPAS_FIXAS.includes(i.chave),
      removida: false,
    };
  });
}

/**
 * Fases do fluxo, uma lista por modalidade (repasse a entidade × aplicação
 * direta). Fixas (Indicada, Empenhada, Liquidada, Paga, Concluída) só mudam
 * de nome e de cor; as demais podem ser movidas, desativadas (o histórico
 * fica) ou, se nunca foram usadas, excluídas. A regra de verdade é a RPC
 * `emendas.salvar_fluxo`; `validarFluxo` só antecipa o aviso.
 */
export function EditorFases({
  catalogo,
  uso,
}: {
  catalogo: CatalogoEtapas;
  uso: Record<Modalidade, Record<string, UsoEtapa>>;
}) {
  const [modalidade, setModalidade] = React.useState<Modalidade>("repasse");
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-[15px] font-semibold text-cataguases-marinho">Fases do fluxo das emendas</h2>
        <p className="mt-0.5 max-w-3xl text-[13px] text-slate-600">
          Cada modalidade tem o seu fluxo. As fases com cadeado (Indicada, Empenhada, Liquidada, Paga e Concluída) alimentam os totais
          de empenhado e pago, por isso só podem ser renomeadas e recoloridas. As demais você move, desativa ou cria. Desativar tira a
          fase das novas opções sem perder o histórico; só uma fase que nunca foi usada pode ser excluída. O nome e a cor de uma fase
          valem nos dois fluxos.
        </p>
        <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Modalidade">
          {(["repasse", "direta"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modalidade === m}
              onClick={() => setModalidade(m)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm transition-colors",
                modalidade === m ? "bg-white font-semibold text-cataguases-marinho shadow-sm" : "text-slate-600 hover:text-cataguases-marinho"
              )}
            >
              {NOME_MODALIDADE[m]}
            </button>
          ))}
        </div>
      </section>

      {(["repasse", "direta"] as const).map((m) => (
        <div key={m} hidden={modalidade !== m}>
          {/* A `key` muda quando o servidor devolve o catálogo salvo: o editor recomeça já com as fases novas. */}
          <EditorFluxo key={JSON.stringify(catalogo)} modalidade={m} catalogo={catalogo} uso={uso[m]} />
        </div>
      ))}
    </div>
  );
}

function EditorFluxo({ modalidade, catalogo, uso }: { modalidade: Modalidade; catalogo: CatalogoEtapas; uso: Record<string, UsoEtapa> }) {
  const router = useRouter();
  const inicial = React.useMemo(() => linhasIniciais(catalogo, modalidade), [catalogo, modalidade]);
  const [linhas, setLinhas] = React.useState<Linha[]>(inicial);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const proximoId = React.useRef(0);

  const visiveis = linhas.filter((l) => !l.removida);
  const alterado = JSON.stringify(linhas) !== JSON.stringify(inicial);

  function atualizar(id: string, parcial: Partial<Linha>) {
    setOk(false);
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...parcial } : l)));
  }

  function mover(id: string, delta: -1 | 1) {
    setOk(false);
    setLinhas((ls) => {
      const lista = ls.filter((l) => !l.removida);
      const i = lista.findIndex((l) => l.id === id);
      const j = i + delta;
      // "Indicada" fica primeiro e "Concluída" por último.
      if (i < 0 || j < 1 || j > lista.length - 2) return ls;
      const alvo = lista[j];
      const a = ls.findIndex((l) => l.id === id);
      const b = ls.findIndex((l) => l.id === alvo.id);
      const copia = ls.slice();
      [copia[a], copia[b]] = [copia[b], copia[a]];
      return copia;
    });
  }

  function adicionar() {
    setOk(false);
    proximoId.current += 1;
    const nova: Linha = { id: `nova-${proximoId.current}`, chave: null, nome: "", cor: COR_NOVA, ativa: true, fixa: false, removida: false };
    setLinhas((ls) => {
      // Entra logo antes de "Empenhada" (a posição mais comum); depois é só mover.
      const i = ls.findIndex((l) => l.chave === "empenhada");
      const copia = ls.slice();
      copia.splice(i < 0 ? ls.length - 1 : i, 0, nova);
      return copia;
    });
  }

  function excluir(l: Linha) {
    setOk(false);
    if (l.chave === null) setLinhas((ls) => ls.filter((x) => x.id !== l.id));
    else atualizar(l.id, { removida: true });
  }

  async function salvar() {
    setErro(null);
    setOk(false);
    const itens = linhas.map((l) => ({ chave: l.chave, nome: l.nome.trim(), cor: l.cor, ativa: l.ativa, remover: l.removida }));
    const aviso = validarFluxo(itens);
    if (aviso) return setErro(aviso);
    setSalvando(true);
    const r = await salvarFluxo({ modalidade, itens });
    setSalvando(false);
    if (!r.sucesso) return setErro(r.erro);
    setOk(true);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-cataguases-marinho">Fluxo: {NOME_MODALIDADE[modalidade]}</h3>
        <button type="button" onClick={adicionar} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#6B4FBB] bg-white px-3 text-sm font-medium text-[#5B3FA8] hover:bg-violet-50">
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar fase
        </button>
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        {visiveis.map((l, i) => {
          const u = l.chave ? uso[l.chave] : undefined;
          const usada = !!u && (u.emendas > 0 || u.andamentos > 0);
          const primeira = i === 0;
          const ultima = i === visiveis.length - 1;
          return (
            <li
              key={l.id}
              className={cn(
                "grid grid-cols-[28px_40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[28px_40px_minmax(0,1fr)_auto]",
                l.ativa ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50"
              )}
            >
              <span className="text-xs tabular-nums text-slate-500">{i + 1}</span>
              <input
                type="color"
                value={l.cor}
                onChange={(e) => atualizar(l.id, { cor: e.target.value.toUpperCase() })}
                aria-label={`Cor da fase ${l.nome || "nova"}`}
                className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <input
                    value={l.nome}
                    onChange={(e) => atualizar(l.id, { nome: e.target.value })}
                    placeholder="Nome da fase"
                    maxLength={60}
                    aria-label={`Nome da fase ${i + 1}`}
                    className={CAMPO}
                  />
                  {l.fixa && <Lock className="h-4 w-4 flex-none text-slate-500" aria-label="Fase fixa" />}
                </div>
                <p className="text-xs text-slate-500">
                  {l.fixa ? "Fixa · " : ""}
                  {!l.ativa ? "Desativada · " : ""}
                  {usada ? `${u!.emendas} ${u!.emendas === 1 ? "emenda está" : "emendas estão"} nesta fase · ${u!.andamentos} ${u!.andamentos === 1 ? "andamento" : "andamentos"} no histórico` : l.chave ? "Nunca usada" : "Nova fase"}
                </p>
              </div>
              <div className="col-span-3 flex flex-wrap items-center justify-end gap-1.5 sm:col-span-1">
                {!l.fixa && (
                  <label className="mr-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={l.ativa} onChange={(e) => atualizar(l.id, { ativa: e.target.checked })} className="h-4 w-4 accent-[#6B4FBB]" />
                    Ativa
                  </label>
                )}
                <button type="button" className={BOTAO_ICONE} onClick={() => mover(l.id, -1)} disabled={l.fixa || primeira || i <= 1} title="Mover para cima" aria-label="Mover para cima">
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" className={BOTAO_ICONE} onClick={() => mover(l.id, 1)} disabled={l.fixa || ultima || i >= visiveis.length - 2} title="Mover para baixo" aria-label="Mover para baixo">
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
                {!l.fixa && (
                  <button
                    type="button"
                    className={BOTAO_ICONE}
                    onClick={() => excluir(l)}
                    disabled={usada}
                    title={usada ? "Já foi usada: desative em vez de excluir" : "Excluir fase"}
                    aria-label="Excluir fase"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {erro && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {erro}
        </p>
      )}
      {ok && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900" role="status">
          Fluxo salvo. As telas do módulo já usam as novas fases.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {alterado && (
          <button
            type="button"
            onClick={() => {
              setLinhas(inicial);
              setErro(null);
              setOk(false);
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Descartar alterações
          </button>
        )}
        <button type="button" onClick={salvar} disabled={!alterado || salvando} className={BOTAO}>
          {salvando ? "Salvando…" : "Salvar fluxo"}
        </button>
      </div>
    </section>
  );
}
