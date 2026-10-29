"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";

import { BaseLegalDica } from "@/components/emendas/base-legal";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from "@/components/emendas/detalhe-emenda";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { salvarTransparencia } from "@/lib/emendas/actions";
import type { ItemConformidade } from "@/lib/emendas/conformidade";
import { cn } from "@/lib/utils";
import type { ExecucaoEmenda } from "@/types/emendas";

const NOME_SUS = { sim: "Sim, houve anuência", nao: "Não houve", nao_se_aplica: "Não se aplica" } as const;

function emReais(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Dados que a IN TCE-MG 05/2025 manda divulgar (art. 7º) e que não cabiam nos demais blocos: localidade,
 * cronograma previsto, finalidade/metas do plano de trabalho, anuência do SUS e identificador contábil.
 * Mostra também o que ainda falta para a divulgação ficar completa.
 */
export function PainelTransparencia({
  emendaId,
  execucao,
  itens,
  saude,
  podeEditar,
}: {
  emendaId: string;
  execucao: ExecucaoEmenda | null;
  itens: ItemConformidade[];
  saude: boolean;
  podeEditar: boolean;
}) {
  const [aberto, setAberto] = React.useState(false);
  const faltando = itens.filter((i) => i.aplica && !i.ok);
  const aplicaveis = itens.filter((i) => i.aplica).length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" id="bloco-transparencia">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-cataguases-marinho">
          Transparência (IN TCE-MG 05/2025)
          <BaseLegalDica chave="publicidade" />
        </h2>
        {podeEditar && (
          <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1 text-xs font-medium text-[#5B3FA8] hover:underline">
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Editar
          </button>
        )}
      </div>

      <p className={cn("mb-2 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs", faltando.length ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-900")}>
        {faltando.length ? <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />}
        {faltando.length ? `${aplicaveis - faltando.length} de ${aplicaveis} itens divulgáveis. Faltam ${faltando.length}.` : `Os ${aplicaveis} itens exigidos estão informados.`}
      </p>
      {faltando.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1 text-xs text-slate-700">
          {faltando.map((f) => (
            <li key={f.codigo}>
              <strong className="font-medium">{f.codigo === "art5" ? "Art. 5º" : `Item ${f.codigo}`} · {f.nome}:</strong> {f.falta}
            </li>
          ))}
        </ul>
      )}

      <dl className="flex flex-col gap-1.5 text-[13px]">
        {[
          ["Localidade beneficiada", execucao?.localidade],
          ["Início previsto", execucao?.inicio_previsto ? execucao.inicio_previsto.split("-").reverse().join("/") : null],
          ["Término previsto", execucao?.termino_previsto ? execucao.termino_previsto.split("-").reverse().join("/") : null],
          ["Finalidade e metas", execucao?.plano_metas],
          ["Outras fontes de recurso", execucao?.plano_outras_fontes != null ? `R$ ${emReais(execucao.plano_outras_fontes)}` : null],
          ...(saude ? [["Anuência do SUS", execucao?.anuencia_sus ? NOME_SUS[execucao.anuencia_sus] : null]] : []),
          ["Identificador contábil", execucao?.identificador_contabil],
          ["Fonte de recurso", execucao?.fonte_recurso],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className={v ? "font-medium text-cataguases-marinho" : "text-xs italic text-slate-400"}>{(v as string | null) || "Não informado"}</dd>
          </div>
        ))}
      </dl>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados de transparência</DialogTitle>
            <DialogDescription>Estas informações são divulgadas no portal público antes da execução da emenda.</DialogDescription>
          </DialogHeader>
          <FormularioTransparencia key={execucao?.atualizado_em ?? "novo"} emendaId={emendaId} execucao={execucao} saude={saude} aoFechar={() => setAberto(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FormularioTransparencia({ emendaId, execucao, saude, aoFechar }: { emendaId: string; execucao: ExecucaoEmenda | null; saude: boolean; aoFechar: () => void }) {
  const [v, setV] = React.useState({
    localidade: execucao?.localidade ?? "",
    inicioPrevisto: execucao?.inicio_previsto ?? "",
    terminoPrevisto: execucao?.termino_previsto ?? "",
    planoMetas: execucao?.plano_metas ?? "",
    planoOutrasFontes: execucao?.plano_outras_fontes != null ? emReais(execucao.plano_outras_fontes) : "",
    anuenciaSus: execucao?.anuencia_sus ?? "",
    anuenciaSusData: execucao?.anuencia_sus_data ?? "",
    identificadorContabil: execucao?.identificador_contabil ?? "",
    fonteRecurso: execucao?.fonte_recurso ?? "",
  });
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const rotulo = "flex flex-col gap-1 text-xs font-medium text-slate-600";

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarTransparencia({
        emendaId,
        localidade: v.localidade,
        inicioPrevisto: v.inicioPrevisto,
        terminoPrevisto: v.terminoPrevisto,
        planoMetas: v.planoMetas,
        planoOutrasFontes: v.planoOutrasFontes,
        anuenciaSus: (v.anuenciaSus || null) as "sim" | "nao" | "nao_se_aplica" | null,
        anuenciaSusData: v.anuenciaSusData,
        identificadorContabil: v.identificadorContabil,
        fonteRecurso: v.fonteRecurso,
      });
      if (!r.sucesso) return setErro(r.erro);
      if (r.aviso) return setAviso(r.aviso);
      aoFechar();
    });
  }

  return (
    <form onSubmit={salvar} className="mt-3 grid gap-3.5 sm:grid-cols-2">
      <label className={`${rotulo} sm:col-span-2`}>
        <span className="flex items-center gap-1.5">Localidade beneficiada <span className="font-normal text-slate-400">(município, bairro ou distrito)</span></span>
        <input className={CAMPO} maxLength={200} value={v.localidade} onChange={set("localidade")} placeholder="Ex.: Cataguases — Bairro Vila Reis" />
      </label>
      <label className={rotulo}>
        Início previsto
        <input type="date" className={CAMPO} value={v.inicioPrevisto} onChange={set("inicioPrevisto")} />
      </label>
      <label className={rotulo}>
        Término previsto
        <input type="date" className={CAMPO} value={v.terminoPrevisto} onChange={set("terminoPrevisto")} />
      </label>
      <label className={`${rotulo} sm:col-span-2`}>
        <span className="flex items-center gap-1.5">Finalidade e metas do plano de trabalho <BaseLegalDica chave="plano_publico" /></span>
        <textarea className={CAMPO} rows={4} maxLength={4000} value={v.planoMetas} onChange={set("planoMetas")} placeholder="O que será feito, para quem e quais resultados se espera (ex.: atender 120 crianças por mês)." />
      </label>
      <label className={rotulo}>
        Outras fontes de recurso (R$)
        <input className={CAMPO} inputMode="decimal" value={v.planoOutrasFontes} onChange={set("planoOutrasFontes")} placeholder="0,00" />
      </label>
      <label className={rotulo}>
        <span className="flex items-center gap-1.5">Identificador contábil <BaseLegalDica chave="contabil" /></span>
        <input className={CAMPO} maxLength={120} value={v.identificadorContabil} onChange={set("identificadorContabil")} placeholder="Código da emenda na Contabilidade" />
      </label>
      <label className={rotulo}>
        Fonte de recurso
        <input className={CAMPO} maxLength={120} value={v.fonteRecurso} onChange={set("fonteRecurso")} />
      </label>
      {saude && (
        <>
          <label className={rotulo}>
            <span className="flex items-center gap-1.5">Anuência do SUS <BaseLegalDica chave="anuencia_sus" /></span>
            <select className={CAMPO} value={v.anuenciaSus} onChange={set("anuenciaSus")}>
              <option value="">Não informado</option>
              {(Object.keys(NOME_SUS) as (keyof typeof NOME_SUS)[]).map((k) => (
                <option key={k} value={k}>{NOME_SUS[k]}</option>
              ))}
            </select>
          </label>
          <label className={rotulo}>
            Data da anuência
            <input type="date" className={CAMPO} value={v.anuenciaSusData} onChange={set("anuenciaSusData")} />
          </label>
        </>
      )}
      {erro && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{erro}</p>}
      {aviso && <p className="text-sm text-amber-900 sm:col-span-2" role="status">{aviso}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={BOTAO_PRIMARIO} disabled={pendente}>{pendente ? "Salvando…" : "Salvar"}</button>
        <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar} disabled={pendente}>{aviso ? "Fechar" : "Cancelar"}</button>
      </div>
    </form>
  );
}
