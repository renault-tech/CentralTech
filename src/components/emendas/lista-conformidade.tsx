"use client";

import * as React from "react";
import Link from "next/link";

import { BaseLegalLinha } from "@/components/emendas/base-legal";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { pct } from "@/lib/emendas/regras";
import type { TipoExecucao } from "@/types/emendas";

export type ResumoItem = { codigo: string; nome: string; exigencia: string; aplicaveis: number; atendem: number };
export type LinhaConformidade = { id: string; numero: number; objeto: string; secretaria: string; tipo: TipoExecucao; executada: boolean; faltas: string[] };

const ESTILO_CAMPO = "h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const POR_PAGINA = 40;

export function ListaConformidade({ ano, resumo, linhas, relatoriosPendentes, contasIrregulares }: { ano: number; resumo: ResumoItem[]; linhas: LinhaConformidade[]; relatoriosPendentes: number; contasIrregulares: number }) {
  const { params, definir: definirUrl } = useFiltrosUrl("emendas-conformidade", String(ano));
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const item = params.get("i") ?? "";
  const soExecutadas = params.get("x") === "1";
  const definir = (m: Record<string, string>) => {
    setLimite(POR_PAGINA);
    definirUrl(m);
  };

  const completas = linhas.filter((l) => l.faltas.length === 0).length;
  const execIncompletas = linhas.filter((l) => l.executada && l.faltas.length > 0).length;
  const filtradas = linhas.filter((l) => (!item || l.faltas.includes(item)) && (!soExecutadas || l.executada) && l.faltas.length > 0);
  const nomeItem = (c: string) => resumo.find((r) => r.codigo === c)?.nome ?? c;
  const rotuloCodigo = (c: string) => (c === "art5" ? "Art. 5º" : `Art. 7º, ${c}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">Conformidade com a IN TCE-MG 05/2025 · {ano}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Itens que o art. 7º manda divulgar antes da execução da emenda (e o identificador contábil do art. 5º). O sistema <strong>alerta</strong>; não impede o empenho.
          </p>
          <BaseLegalLinha chave="publicidade" className="mt-1" />
        </div>
        <MenuExportar
          opcoes={[{ rotulo: "Imprimir / salvar como PDF", detalhe: "Usa a impressão do navegador", imprimir: true }]}
        />
      </div>

      <section aria-label="Como ler esta tela" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-cataguases-marinho">Para que serve esta tela</h2>
        <p className="mt-1 max-w-4xl text-sm text-slate-700">
          A norma do TCE-MG obriga a Prefeitura a publicar, <strong>antes de executar</strong> cada emenda, uma lista de informações (quem executa, onde, valor, prazos, conta bancária…).
          Aqui você vê, item a item, quantas emendas já têm essa informação preenchida e quais ainda não.
        </p>
        <ol className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-700 md:grid-cols-3">
          <li><strong className="text-cataguases-marinho">1. Veja o quadro de itens.</strong> “Faltam” é quantas emendas ainda não têm aquela informação.</li>
          <li><strong className="text-cataguases-marinho">2. Clique no número de “Faltam”.</strong> A lista abaixo mostra só essas emendas.</li>
          <li><strong className="text-cataguases-marinho">3. Abra a emenda e preencha.</strong> O que falta aparece nela, na aba “Documentação” e em “Parceria e execução”.</li>
        </ol>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Emendas completas", `${completas} de ${linhas.length}`, completas === linhas.length ? "#166534" : "#0C1D33", "com todas as informações exigidas"],
          ["Executadas com itens faltando", String(execIncompletas), execIncompletas ? "#B91C1C" : "#166534", "já empenhadas ou pagas e incompletas: prioridade"],
          ["Relatórios de gestão pendentes", String(relatoriosPendentes), relatoriosPendentes ? "#B45309" : "#166534", "prestação anual da parceria após o pagamento"],
          ["Contas irregulares (art. 6º)", String(contasIrregulares), contasIrregulares ? "#B45309" : "#166534", "conta repetida ou fora de banco oficial"],
        ].map(([k, v, cor, apoio]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <dt className="text-xs font-medium text-slate-600">{k}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: cor }}>{v}</dd>
            <dd className="mt-0.5 text-[0.6875rem] leading-snug text-slate-600">{apoio}</dd>
          </div>
        ))}
      </dl>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th scope="col" className="px-3.5 py-2.5 font-medium">Artigo</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">O que precisa estar publicado</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Atendem</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Faltam (clique)</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => {
              const falta = r.aplicaveis - r.atendem;
              return (
                <tr key={r.codigo} className="border-t border-slate-100 align-top">
                  <td className="px-3.5 py-2.5 font-mono text-xs text-slate-500">{r.codigo === "art5" ? "Art. 5º" : `Art. 7º, ${r.codigo}`}</td>
                  <td className="px-3.5 py-2.5">
                    <strong className="font-medium text-cataguases-marinho">{r.nome}</strong>
                    <span className="block text-xs text-slate-500">{r.exigencia}</span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-right tabular-nums">
                    {r.aplicaveis ? `${r.atendem} de ${r.aplicaveis} · ${pct(r.atendem / r.aplicaveis, 0)}` : "não se aplica"}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {falta > 0 ? (
                      <button type="button" onClick={() => definir({ i: item === r.codigo ? "" : r.codigo })} className="font-medium tabular-nums text-[#5B3FA8] hover:underline" aria-pressed={item === r.codigo}>
                        {falta}
                      </button>
                    ) : (
                      <span className="text-green-700">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-[0.9375rem] font-semibold text-cataguases-marinho">Emendas com itens a completar ({filtradas.length})</h2>
        {item && (
          <button type="button" onClick={() => definir({ i: "" })} className={ESTILO_CAMPO + " text-xs"}>
            Filtro: {rotuloCodigo(item)} · {nomeItem(item)} ✕
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-[#6B4FBB]" checked={soExecutadas} onChange={(e) => definir({ x: e.target.checked ? "1" : "" })} />
          Só as já empenhadas ou pagas
        </label>
      </div>

      <ul className="flex flex-col gap-2">
        {filtradas.slice(0, limite).map((l) => (
          <li key={l.id}>
            <Link href={`/emendas/${l.id}`} className="block rounded-lg border border-slate-200 bg-white p-3.5 hover:bg-violet-50/40" style={{ borderLeft: `4px solid ${l.executada ? "#B91C1C" : "#94A3B8"}` }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-mono text-xs text-slate-500">nº {l.numero}</span>
                <strong className="min-w-0 flex-1 text-sm text-cataguases-marinho">{l.objeto}</strong>
                {l.executada && <span className="text-xs font-medium text-red-700">já executada</span>}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                <TipoSelo tipo={l.tipo} />
                <span>{l.secretaria}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-600">Falta preencher:</span>
                {l.faltas.map((c) => (
                  <span key={c} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700" title={rotuloCodigo(c)}>{nomeItem(c)}</span>
                ))}
              </p>
            </Link>
          </li>
        ))}
        {filtradas.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhuma emenda com itens faltando nesse filtro.</li>}
      </ul>
      {filtradas.length > limite && (
        <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="mx-auto h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
          Mostrar mais {POR_PAGINA}
        </button>
      )}
    </div>
  );
}
