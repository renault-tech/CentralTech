"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { BOTAO, CAMPO, Erro, Secao, useSalvar } from "@/components/emendas/config/editores";
import {
  removerFaseCatalogo,
  removerItemChecklistCatalogo,
  salvarFaseCatalogo,
  salvarItemChecklistCatalogo,
  salvarOrdemChecklist,
  salvarOrdemFases,
} from "@/lib/emendas/actions-config";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { cn } from "@/lib/utils";
import type { FaseFluxo, ItemChecklist, TipoExecucao } from "@/types/emendas";

const LINK = "rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40";
const DERIVADA: Record<string, string> = {
  loa: "vem da LOA",
  parecer: "vem do parecer",
  empenho: "vem do Financeiro",
  liquidacao: "vem do Financeiro",
  pagamento: "vem do Financeiro",
  termo: "vem da Parceria",
  extrato: "vem da Parceria",
};
const NOME_CONDICAO = { saude: "só Saúde", consorcio: "só consórcio" } as const;

/** Fases e documentos de cada tipo de execução (antes só por SQL). */
export function EditorCatalogoTipo({
  fases,
  itens,
  etapas,
}: {
  fases: FaseFluxo[];
  itens: ItemChecklist[];
  etapas: { chave: string; nome: string }[];
}) {
  const [tipo, setTipo] = React.useState<TipoExecucao>("osc");
  const cor = TIPOS_EXECUCAO[tipo].cor;
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Tipo de execução" className="flex flex-wrap gap-1 border-b border-slate-200">
        {ORDEM_TIPOS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tipo === t}
            onClick={() => setTipo(t)}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-sm",
              tipo === t ? "font-semibold text-cataguases-marinho" : "border-transparent text-slate-600 hover:text-cataguases-marinho"
            )}
            style={tipo === t ? { borderBottomColor: TIPOS_EXECUCAO[t].cor } : undefined}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIPOS_EXECUCAO[t].cor }} aria-hidden />
            {TIPOS_EXECUCAO[t].nome}
          </button>
        ))}
      </div>
      <Secao titulo="Fases" apoio="A ordem aqui é a ordem da linha do tempo da emenda. Fase “vem de outro dado” só renomeia ou desativa; as demais são preenchidas à mão na emenda.">
        <ListaFases key={`f-${tipo}`} tipo={tipo} cor={cor} fases={fases.filter((f) => f.tipo === tipo)} etapas={etapas} />
      </Secao>
      <Secao titulo="Documentos (checklist)" apoio="Itens que o gestor confere em cada emenda deste tipo. Itens “só Saúde” ou “só consórcio” aparecem apenas nas emendas que se encaixam.">
        <ListaItens key={`i-${tipo}`} tipo={tipo} itens={itens.filter((i) => i.tipo === tipo)} />
      </Secao>
    </div>
  );
}

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const n = lista.slice();
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

function ListaFases({ tipo, cor, fases, etapas }: { tipo: TipoExecucao; cor: string; fases: FaseFluxo[]; etapas: { chave: string; nome: string }[] }) {
  const { erro, salvando, salvar } = useSalvar();
  const ordenadas = fases.slice().sort((a, b) => a.ordem - b.ordem);
  const [editando, setEditando] = React.useState<string | "novo" | null>(null);
  const nomeEtapa = (c: string) => etapas.find((e) => e.chave === c)?.nome ?? c;

  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {ordenadas.map((f, i) =>
          editando === f.chave ? (
            <FormFase key={f.chave} tipo={tipo} fase={f} etapas={etapas} aoFechar={() => setEditando(null)} />
          ) : (
            <li key={f.chave} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]", !f.ativa && "opacity-55")}>
              <span className="h-5 w-1 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-cataguases-marinho">
                  {f.nome}
                  {!f.ativa && <span className="ml-2 rounded bg-slate-100 px-1.5 py-px text-xs font-normal">desativada</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {f.derivacao ? DERIVADA[f.derivacao] : `manual · etapa ${nomeEtapa(f.etapa)}`}
                  {f.referencia ? ` · ${f.referencia}` : ""}
                </p>
              </div>
              <button type="button" aria-label="Subir" className={LINK} disabled={salvando || i === 0} onClick={() => void salvar(() => salvarOrdemFases({ tipo, chaves: mover(ordenadas, i, -1).map((x) => x.chave) }))}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Descer" className={LINK} disabled={salvando || i === ordenadas.length - 1} onClick={() => void salvar(() => salvarOrdemFases({ tipo, chaves: mover(ordenadas, i, 1).map((x) => x.chave) }))}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Editar ${f.nome}`} className={LINK} onClick={() => setEditando(f.chave)}>
                <Pencil className="h-4 w-4" />
              </button>
              {!f.derivacao && (
                <button type="button" aria-label={`Remover ${f.nome}`} className={LINK} disabled={salvando} onClick={() => void salvar(() => removerFaseCatalogo(tipo, f.chave))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          )
        )}
        {editando === "novo" && <FormFase tipo={tipo} etapas={etapas} aoFechar={() => setEditando(null)} />}
      </ul>
      <Erro texto={erro} />
      {editando !== "novo" && (
        <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditando("novo")}>
          <Plus className="h-4 w-4" aria-hidden /> Nova fase
        </button>
      )}
    </div>
  );
}

function FormFase({ tipo, fase, etapas, aoFechar }: { tipo: TipoExecucao; fase?: FaseFluxo; etapas: { chave: string; nome: string }[]; aoFechar: () => void }) {
  const [nome, setNome] = React.useState(fase?.nome ?? "");
  const [referencia, setReferencia] = React.useState(fase?.referencia ?? "");
  const [etapa, setEtapa] = React.useState(fase?.etapa ?? "plano_trabalho");
  const [ativa, setAtiva] = React.useState(fase?.ativa ?? true);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="grid gap-3 bg-slate-50 p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Nome da fase
        <input className={CAMPO} value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Base legal ou observação
        <input className={CAMPO} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      </label>
      {!fase?.derivacao && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Etapa da emenda ao concluir
          <select className={CAMPO} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            {etapas.map((e) => (
              <option key={e.chave} value={e.chave}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:self-end">
        <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
        Fase ativa
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          className={BOTAO}
          disabled={salvando}
          onClick={() => void salvar(() => salvarFaseCatalogo({ tipo, chave: fase?.chave ?? null, nome, etapa, referencia, ativa }), aoFechar)}
        >
          Salvar
        </button>
        <button type="button" className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-sm hover:bg-slate-50" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <div className="sm:col-span-2">
        <Erro texto={erro} />
      </div>
    </li>
  );
}

function ListaItens({ tipo, itens }: { tipo: TipoExecucao; itens: ItemChecklist[] }) {
  const { erro, salvando, salvar } = useSalvar();
  const ordenados = itens.slice().sort((a, b) => a.ordem - b.ordem);
  const [editando, setEditando] = React.useState<string | "novo" | null>(null);
  return (
    <div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {ordenados.map((it, i) =>
          editando === it.chave ? (
            <FormItem key={it.chave} tipo={tipo} item={it} aoFechar={() => setEditando(null)} />
          ) : (
            <li key={it.chave} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]", !it.ativo && "opacity-55")}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-cataguases-marinho">
                  {it.nome}
                  {it.condicao && <span className="ml-2 rounded bg-violet-100 px-1.5 py-px text-xs font-normal text-violet-900">{NOME_CONDICAO[it.condicao]}</span>}
                  {!it.ativo && <span className="ml-2 rounded bg-slate-100 px-1.5 py-px text-xs font-normal">desativado</span>}
                </p>
                {it.referencia_legal && <p className="text-xs text-slate-500">{it.referencia_legal}</p>}
              </div>
              <button type="button" aria-label="Subir" className={LINK} disabled={salvando || i === 0} onClick={() => void salvar(() => salvarOrdemChecklist({ tipo, chaves: mover(ordenados, i, -1).map((x) => x.chave) }))}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Descer" className={LINK} disabled={salvando || i === ordenados.length - 1} onClick={() => void salvar(() => salvarOrdemChecklist({ tipo, chaves: mover(ordenados, i, 1).map((x) => x.chave) }))}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Editar ${it.nome}`} className={LINK} onClick={() => setEditando(it.chave)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" aria-label={`Remover ${it.nome}`} className={LINK} disabled={salvando} onClick={() => void salvar(() => removerItemChecklistCatalogo(tipo, it.chave))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          )
        )}
        {editando === "novo" && <FormItem tipo={tipo} aoFechar={() => setEditando(null)} />}
      </ul>
      <Erro texto={erro} />
      {editando !== "novo" && (
        <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditando("novo")}>
          <Plus className="h-4 w-4" aria-hidden /> Novo documento
        </button>
      )}
    </div>
  );
}

function FormItem({ tipo, item, aoFechar }: { tipo: TipoExecucao; item?: ItemChecklist; aoFechar: () => void }) {
  const [nome, setNome] = React.useState(item?.nome ?? "");
  const [referencia, setReferencia] = React.useState(item?.referencia_legal ?? "");
  const [condicao, setCondicao] = React.useState<"" | "saude" | "consorcio">(item?.condicao ?? "");
  const [ativo, setAtivo] = React.useState(item?.ativo ?? true);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="grid gap-3 bg-slate-50 p-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Documento
        <input className={CAMPO} value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Base legal
        <input className={CAMPO} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Quando se aplica
        <select className={CAMPO} value={condicao} onChange={(e) => setCondicao(e.target.value as typeof condicao)}>
          <option value="">Sempre</option>
          <option value="saude">Só emendas de Saúde</option>
          <option value="consorcio">Só consórcio (natureza 93)</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:self-end">
        <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Documento ativo
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          className={BOTAO}
          disabled={salvando}
          onClick={() => void salvar(() => salvarItemChecklistCatalogo({ tipo, chave: item?.chave ?? null, nome, referencia, condicao: condicao || null, ativo }), aoFechar)}
        >
          Salvar
        </button>
        <button type="button" className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-sm hover:bg-slate-50" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <div className="sm:col-span-2">
        <Erro texto={erro} />
      </div>
    </li>
  );
}
