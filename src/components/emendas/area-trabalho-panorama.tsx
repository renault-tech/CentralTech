"use client";

import * as React from "react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/emendas/caixa-info";
import { EspacoTrabalho } from "@/components/emendas/espaco-trabalho";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { VoltarAoTopo } from "@/components/emendas/voltar-ao-topo";
import { PainelDetalheEmenda } from "@/components/emendas/painel-detalhe-emenda";
import { useFiltrosUrl } from "@/components/modulo/use-filtros-url";
import { COR_SITUACAO, CARTOES, agrupar, pertenceAoCartao, rotuloSituacao, totaisPorCartao, type Cartao, type LinhaPanorama } from "@/lib/emendas/encerramento";
import type { RestoAnterior } from "@/lib/emendas/panorama-dados";
import { brl, dataBr } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

type Grupo = { titulo: string; itens: { c: Cartao; nome: string; apoio: string; tom?: "alerta" | "ok" | "info" | "neutro" }[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Visão geral",
    itens: [
      { c: "todas", nome: "Emendas do exercício", apoio: "valor total indicado" },
      { c: "empenhadas", nome: "Empenhado", apoio: "emendas com empenho" },
      { c: "pagas", nome: "Pago", apoio: "emendas com pagamento" },
    ],
  },
  {
    titulo: "O que falta executar",
    itens: [
      { c: "a_pagar", nome: "Empenho não pago", apoio: "empenhado − pago", tom: "alerta" },
      { c: "sem_empenho_andamento", nome: "Sem empenho, em andamento", apoio: "ainda pode ser empenhado", tom: "alerta" },
      { c: "sem_empenho_encerrada", nome: "Sem empenho, emenda encerrada", apoio: "economia que volta ao caixa" },
    ],
  },
  {
    titulo: "Situação das emendas",
    itens: [
      { c: "cumprida", nome: "Cumpridas", apoio: "objeto entregue", tom: "ok" },
      { c: "cumprida_economia", nome: "Cumpridas com economia ou devolução", apoio: "entregues gastando menos", tom: "ok" },
      { c: "nao_cumprida", nome: "Não cumpridas", apoio: "impedimento ou desistência", tom: "alerta" },
      { c: "restos_a_pagar", nome: "Em restos a pagar", apoio: "empenho que passa ao próximo exercício", tom: "info" },
      { c: "sem_situacao", nome: "Sem situação definida", apoio: "falta o gestor encerrar", tom: "neutro" },
    ],
  },
  {
    titulo: "Conciliação com o IPM",
    itens: [
      { c: "anular", nome: "Empenho a anular", apoio: "emenda encerrada com empenho sem pagar", tom: "alerta" },
      { c: "devolucao", nome: "Devoluções de repasse", apoio: "saldo devolvido pela entidade", tom: "info" },
      { c: "excesso", nome: "Acima do valor da emenda", apoio: "exige a fonte de recurso", tom: "alerta" },
    ],
  },
];

const VISOES = [
  { chave: "emendas", rotulo: "Emendas" },
  { chave: "secretaria", rotulo: "Por secretaria" },
  { chave: "vereador", rotulo: "Por vereador" },
  { chave: "tipo", rotulo: "Por tipo" },
  { chave: "restos", rotulo: "Restos anteriores" },
] as const;
type Visao = (typeof VISOES)[number]["chave"];

const NOME_CARTAO = Object.fromEntries(GRUPOS.flatMap((g) => g.itens.map((i) => [i.c, i.nome]))) as Record<Cartao, string>;
const CAMPO = "h-10 min-w-0 rounded-xl border border-slate-300 bg-white/80 px-3 text-sm text-cataguases-marinho outline-none transition-shadow focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25";
const COR_TOM = { alerta: "#B45309", ok: "#15803D", info: "#1D4ED8", neutro: "#0C1D33" } as const;
const NOME_TIPO: Record<string, string> = { "Execução direta": "direta", "Repasse a OSC": "osc", "Repasse a ente": "ente" };

/**
 * Panorama no padrão da área de trabalho: os cartões à esquerda são filtros, a lista (ou o quadro por secretaria, vereador e tipo)
 * responde ao lado e a emenda escolhida abre à direita, na aba Financeiro. Cada pessoa vê o que a RLS libera.
 */
export function AreaTrabalhoPanorama({ linhas, restos, ano }: { linhas: LinhaPanorama[]; restos: RestoAnterior[]; ano: number }) {
  const { params, definir } = useFiltrosUrl("emendas-panorama", String(ano));
  const [expandidaId, setExpandidaId] = React.useState("");
  const listaRef = React.useRef<HTMLUListElement>(null);
  const s = params.get("s") ?? "";
  const t = params.get("t") ?? "";
  const c = params.get("c") ?? "";
  const q = params.get("q") ?? "";
  const escolhidaId = params.get("e") ?? "";
  const aberto = !!escolhidaId;
  const expandido = aberto && expandidaId === escolhidaId;

  const secretarias = React.useMemo(() => [...new Map(linhas.map((l) => [l.secretaria_id, l.secretaria_nome])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [linhas]);
  const recorte = React.useMemo(() => linhas.filter((l) => (!s || l.secretaria_id === s) && (!t || l.tipo_execucao === t)), [linhas, s, t]);
  const totais = React.useMemo(() => totaisPorCartao(recorte), [recorte]);
  const cartao: Cartao | null = (CARTOES as readonly string[]).includes(c) ? (c as Cartao) : null;
  const lista = React.useMemo(() => (cartao ? recorte.filter((l) => pertenceAoCartao(l, cartao)) : recorte), [recorte, cartao]);
  const visao: Visao = VISOES.some((v) => v.chave === q && (v.chave !== "restos" || restos.length > 0)) ? (q as Visao) : "emendas";
  const quadro = React.useMemo(() => (visao === "secretaria" || visao === "vereador" || visao === "tipo" ? agrupar(recorte, visao) : []), [recorte, visao]);
  const qExport = new URLSearchParams({ ano: String(ano), ...(s ? { s } : {}), ...(t ? { t } : {}) }).toString();
  const filtrosAtivos = (s ? 1 : 0) + (t ? 1 : 0) + (cartao ? 1 : 0);
  const fechar = () => definir({ e: "" });

  return (
    <EspacoTrabalho
      aberto={aberto}
      expandido={expandido}
      aoFechar={fechar}
      aoRecolher={() => setExpandidaId("")}
      filtrosAtivos={filtrosAtivos}
      rotuloLista="Emendas do Panorama"
      rotuloDetalhe="Emenda escolhida"
      graficos={
        <>
          <div className="flex flex-none flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <label className="sr-only" htmlFor="pan-sec">Secretaria</label>
            <select id="pan-sec" value={s} onChange={(e) => definir({ s: e.target.value })} className={cn(CAMPO, "flex-1")}>
              <option value="">Todas as secretarias</option>
              {secretarias.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="pan-tipo">Tipo de execução</label>
            <select id="pan-tipo" value={t} onChange={(e) => definir({ t: e.target.value })} className={cn(CAMPO, "flex-1")}>
              <option value="">Todos os tipos</option>
              <option value="direta">Execução direta</option>
              <option value="osc">Repasse a OSC</option>
              <option value="ente">Repasse a ente</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            {GRUPOS.map((g) => (
              <section key={g.titulo} aria-label={g.titulo}>
                <h2 className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-600">{g.titulo}</h2>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2">
                  {g.itens.map((i) => {
                    const tot = totais[i.c];
                    const ativo = cartao === i.c;
                    return (
                      <CaixaInfo
                        key={i.c}
                        as="li"
                        conteudo={
                          <>
                            <CaixaTitulo rotulo={g.titulo} valor={brl(tot.valor)} lado={String(tot.quantidade)} ladoApoio="emenda(s)" corLado={COR_TOM[i.tom ?? "neutro"]} />
                            <CaixaLinhas linhas={[{ rotulo: i.nome, valor: brl(tot.valor) }, { rotulo: "No recorte atual", valor: `${tot.quantidade} de ${recorte.length}` }]} />
                            <CaixaNota>{i.apoio}. Clique para listar estas emendas.</CaixaNota>
                          </>
                        }
                      >
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => definir({ c: ativo ? "" : i.c, q: visao === "restos" ? "" : q })}
                          className={cn("block h-full w-full rounded-xl border p-2.5 text-left transition-colors duration-200 hover:border-[color:var(--modulo)]/60", ativo ? "border-[color:var(--modulo)] bg-[color-mix(in_srgb,var(--modulo)_8%,transparent)] ring-1 ring-[color:var(--modulo)]" : "border-slate-200 bg-slate-50/60")}
                        >
                          <span className="text-[0.8125rem] text-slate-700">{i.nome}</span>
                          <span className="mt-0.5 block text-[1.0625rem] font-semibold tabular-nums" style={{ color: COR_TOM[i.tom ?? "neutro"] }}>{brl(tot.valor)}</span>
                          <span className="mt-0.5 block text-[0.75rem] leading-snug text-slate-600">{tot.quantidade} emenda(s) · {i.apoio}</span>
                        </button>
                      </CaixaInfo>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      }
      lista={
        <>
          <div className="flex-none space-y-2.5 border-b border-slate-200 px-4 pb-2 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="O que listar" className="emd-segmento flex min-w-0 flex-wrap items-center gap-0.5 rounded-xl bg-slate-200/60 p-0.5">
                {VISOES.filter((v) => v.chave !== "restos" || restos.length > 0).map((v) => (
                  <button
                    key={v.chave}
                    type="button"
                    role="tab"
                    aria-selected={visao === v.chave}
                    onClick={() => definir({ q: v.chave === "emendas" ? "" : v.chave })}
                    className={cn("inline-flex h-8 items-center rounded-lg px-2.5 text-[0.8125rem] transition-all duration-200", visao === v.chave ? "bg-white font-semibold text-cataguases-marinho shadow-sm" : "font-medium text-slate-600 hover:text-cataguases-marinho")}
                  >
                    {v.rotulo}
                    {v.chave === "restos" && <span className="ml-1.5 tabular-nums text-slate-600">{restos.length}</span>}
                  </button>
                ))}
              </div>
              <span className="ml-auto print:hidden">
                <MenuExportar
                  opcoes={[
                    { rotulo: "Excel (.xlsx)", detalhe: "Relatório completo, com os filtros atuais", href: `/emendas/panorama/exportar?${qExport}` },
                    { rotulo: "PDF", detalhe: "Resumo para imprimir ou enviar", href: `/emendas/panorama/exportar?${qExport}&formato=pdf` },
                  ]}
                />
              </span>
            </div>
            <p className="min-h-7 text-[0.8125rem] text-slate-600" aria-live="polite">
              {visao === "emendas" && (
                <>
                  <strong className="font-semibold text-cataguases-marinho">{lista.length}</strong> emenda(s){cartao ? ` · ${NOME_CARTAO[cartao]}` : ""}
                  {cartao && (
                    <button type="button" onClick={() => definir({ c: "" })} className="ml-2 font-medium text-[color:var(--modulo-tinta)] hover:underline">limpar seleção</button>
                  )}
                </>
              )}
              {(visao === "secretaria" || visao === "vereador" || visao === "tipo") && "Totais do recorte atual. Clique numa secretaria ou tipo para filtrar."}
              {visao === "restos" && `Restos a pagar de exercícios anteriores: ${brl(restos.reduce((x, l) => x + l.aPagar, 0))} em ${restos.length} emenda(s).`}
            </p>
          </div>

          {visao === "emendas" && (
            <div className="relative flex min-h-0 flex-1 flex-col">
            <ul ref={listaRef} className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Emendas">
              {lista.length === 0 && <li className="p-6 text-sm text-slate-600">Nenhuma emenda nesse recorte.</li>}
              {lista.map((l) => (
                <li key={l.id} className="border-b border-slate-100">
                  <button type="button" aria-pressed={l.id === escolhidaId} onClick={() => definir({ e: l.id === escolhidaId ? "" : l.id })} className={cn("emd-item relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2.5 pl-5 pr-4 text-left outline-none", l.id === escolhidaId && "emd-item-sel")}>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-medium text-cataguases-marinho" title={l.objeto}><span className="font-mono text-xs text-slate-600">{l.numero}</span> {l.beneficiario_nome || l.objeto}</span>
                      <span className="block truncate text-xs text-slate-600">{l.secretaria_nome} · {l.vereador_nome}</span>
                      <span className="mt-1 block">
                        {l.encerramento ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${COR_SITUACAO[l.encerramento].selo}`}>{rotuloSituacao(l.encerramento, l.tipo_execucao)}{l.encerradaEm ? ` · ${dataBr(l.encerradaEm)}` : ""}</span>
                        ) : (
                          <span className="text-xs text-slate-600">Sem situação definida</span>
                        )}
                      </span>
                    </span>
                    <span className="text-right text-xs tabular-nums text-slate-600">
                      <span className="block text-[0.875rem] font-semibold text-cataguases-marinho">{brl(l.valor)}</span>
                      <span className="block">emp. {brl(l.empenhado)}</span>
                      <span className="block">pago {brl(l.pago)}</span>
                      {l.aPagar > 0 && <span className="block font-medium" style={{ color: "#B45309" }}>a pagar {brl(l.aPagar)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <VoltarAoTopo alvoRef={listaRef} />
            </div>
          )}

          {(visao === "secretaria" || visao === "vereador" || visao === "tipo") && (
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
              {quadro.length === 0 ? (
                <p className="p-6 text-sm text-slate-600">Nada a mostrar neste recorte.</p>
              ) : (
                <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th scope="col" className="px-3.5 py-2 font-medium">Nome</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Emendas</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Empenhado</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Pago</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Sem empenhar</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Restos</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Cumpridas</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Sem situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quadro.map((r) => {
                      const idSec = visao === "secretaria" ? recorte.find((l) => l.secretaria_nome === r.nome)?.secretaria_id : undefined;
                      const tipo = visao === "tipo" ? NOME_TIPO[r.nome] : undefined;
                      const filtro = idSec ? { s: idSec } : tipo ? { t: tipo } : null;
                      return (
                        <tr key={r.chave} className="border-t border-slate-100">
                          <th scope="row" className="px-3.5 py-2 text-left font-medium text-cataguases-marinho">
                            {filtro ? (
                              <button type="button" onClick={() => definir({ ...filtro, q: "" })} className="text-left text-[color:var(--modulo-tinta)] hover:underline" title="Filtrar o Panorama por este item">{r.nome}</button>
                            ) : (
                              r.nome
                            )}
                          </th>
                          <td className="px-3 py-2 text-right tabular-nums">{r.emendas}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(r.valor)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(r.empenhado)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(r.pago)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.semEmpenhar ? brl(r.semEmpenhar) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.restos ? brl(r.restos) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.cumpridas}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.semSituacao}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {visao === "restos" && (
            <ul className="emd-lista min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Restos a pagar de exercícios anteriores">
              {restos.map((l) => (
                <li key={l.id} className="border-b border-slate-100">
                  <button type="button" aria-pressed={l.id === escolhidaId} onClick={() => definir({ e: l.id === escolhidaId ? "" : l.id })} className={cn("emd-item relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2.5 pl-5 pr-4 text-left outline-none", l.id === escolhidaId && "emd-item-sel")}>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] font-medium text-cataguases-marinho"><span className="font-mono text-xs text-slate-600">{l.ano} · {l.numero}</span> {l.beneficiario_nome || l.objeto}</span>
                      <span className="block truncate text-xs text-slate-600">{l.secretaria_nome}</span>
                    </span>
                    <span className="text-right text-xs tabular-nums text-slate-600">
                      <span className="block">emp. {brl(l.empenhado)} · pago {brl(l.pago)}</span>
                      <span className="block font-medium" style={{ color: "#B45309" }}>a pagar {brl(l.aPagar)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      detalhe={
        aberto && (
          <PainelDetalheEmenda emendaId={escolhidaId} abaInicial="financeiro" aoFechar={fechar} expandido={expandido} aoExpandir={() => setExpandidaId(expandido ? "" : escolhidaId)} />
        )
      }
    />
  );
}
