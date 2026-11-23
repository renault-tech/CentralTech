import Link from "next/link";
import { Gauge } from "lucide-react";

import { Vazio } from "@/components/emendas/ui";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { resolverExercicio } from "@/lib/emendas/dados";
import { carregarPanorama, carregarRestosAnteriores } from "@/lib/emendas/panorama-dados";
import {
  COR_SITUACAO,
  CARTOES,
  agrupar,
  pertenceAoCartao,
  rotuloSituacao,
  totaisPorCartao,
  type Cartao,
} from "@/lib/emendas/encerramento";
import { brl, dataBr } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

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

const QUADROS = [
  { chave: "secretaria", rotulo: "Por secretaria" },
  { chave: "vereador", rotulo: "Por vereador" },
  { chave: "tipo", rotulo: "Por tipo de execução" },
] as const;

const NOME_CARTAO = Object.fromEntries(GRUPOS.flatMap((g) => g.itens.map((i) => [i.c, i.nome]))) as Record<Cartao, string>;
const CAMPO_FILTRO = "h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB] sm:h-[38px]";
const COR_TOM = { alerta: "#B45309", ok: "#15803D", info: "#1D4ED8", neutro: "#0C1D33" } as const;

/**
 * Panorama da execução: o cenário global das emendas do exercício, para acompanhar o ano todo (não só no encerramento).
 * Cada cartão é um filtro: ao clicar, a lista abaixo mostra as emendas a que o número se refere. O Excel/PDF completo
 * serve à prestação de contas e à conciliação com a Contabilidade. Cada pessoa vê o que a RLS libera.
 */
export default async function PaginaPanorama({ searchParams }: { searchParams: Promise<{ ano?: string; c?: string; s?: string; t?: string; q?: string }> }) {
  const { ano, c, s, t, q } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const [{ linhas: todas }, restosAnteriores] = await Promise.all([carregarPanorama(exercicio.ano), carregarRestosAnteriores(exercicio.ano)]);
  const secretarias = new Map(todas.map((l) => [l.secretaria_id, l.secretaria_nome]));
  const recorte = todas.filter((l) => (!s || l.secretaria_id === s) && (!t || l.tipo_execucao === t));
  const cartao: Cartao | null = (CARTOES as readonly string[]).includes(c ?? "") ? (c as Cartao) : null;
  const totais = totaisPorCartao(recorte);
  const lista = cartao ? recorte.filter((l) => pertenceAoCartao(l, cartao)) : [];
  const quadro = QUADROS.some((x) => x.chave === q) ? (q as (typeof QUADROS)[number]["chave"]) : "secretaria";
  const href = (nova: Cartao | null, outroQuadro?: string) => {
    const p = new URLSearchParams({ ano: String(exercicio.ano), ...(s ? { s } : {}), ...(t ? { t } : {}), ...(nova ? { c: nova } : {}), ...((outroQuadro ?? q) ? { q: (outroQuadro ?? q) as string } : {}) });
    return `/emendas/panorama?${p.toString()}`;
  };
  // A exportação leva o cartão escolhido (c) além de secretaria e tipo: o arquivo sai com as MESMAS emendas da lista da tela.
  const qExport = new URLSearchParams({ ano: String(exercicio.ano), ...(s ? { s } : {}), ...(t ? { t } : {}), ...(cartao ? { c: cartao } : {}) }).toString();
  const exportar = `/emendas/panorama/exportar?${qExport}`;
  const linhasDoQuadro = agrupar(recorte, quadro);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-cataguases-marinho">
            <Gauge className="h-6 w-6 text-[#5B3FA8]" aria-hidden /> Panorama da execução · {exercicio.ano}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            O cenário global das emendas durante todo o ano: o que já foi empenhado e pago, o que falta, como cada emenda foi encerrada e o que a Contabilidade precisa conciliar. Clique em um cartão para ver as emendas.
          </p>
        </div>
        <MenuExportar
          opcoes={[
            { rotulo: "PDF para apresentação", detalhe: "Indicadores e gráficos do recorte atual, para mostrar ao prefeito", href: `${exportar}&formato=pdf&tabela=0` },
            { rotulo: "PDF completo", detalhe: "Gráficos, indicadores e tabelas por secretaria, vereador e emenda", href: `${exportar}&formato=pdf` },
            { rotulo: "Excel (.xlsx)", detalhe: "Relatório completo com a conciliação do IPM", href: exportar },
          ]}
        />
      </div>

      <FormularioFiltros className="flex flex-wrap items-center gap-2" limpar={{ href: `/emendas/panorama?ano=${exercicio.ano}${c ? `&c=${c}` : ""}`, className: "text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900", visivel: !!(s || t) }}>
        <input type="hidden" name="ano" value={exercicio.ano} />
        {c && <input type="hidden" name="c" value={c} />}
        {q && <input type="hidden" name="q" value={q} />}
        <label className="sr-only" htmlFor="f-sec">Secretaria</label>
        <select id="f-sec" name="s" defaultValue={s ?? ""} className={CAMPO_FILTRO}>
          <option value="">Todas as secretarias</option>
          {[...secretarias.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-tipo">Tipo de execução</label>
        <select id="f-tipo" name="t" defaultValue={t ?? ""} className={CAMPO_FILTRO}>
          <option value="">Todos os tipos</option>
          <option value="direta">Execução direta</option>
          <option value="osc">Repasse a OSC</option>
          <option value="ente">Repasse a ente</option>
        </select>
      </FormularioFiltros>

      {/* Quatro quadros lado a lado (dois por linha em tela larga); os cartões de cada quadro crescem para ocupar a linha toda. */}
      <div className="grid gap-4 lg:grid-cols-2">
        {GRUPOS.map((g) => (
          <section key={g.titulo} aria-label={g.titulo} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{g.titulo}</h2>
            <ul className="flex flex-wrap gap-2.5">
              {g.itens.map((i) => {
                const tot = totais[i.c];
                const ativo = cartao === i.c;
                return (
                  <li key={i.c} className="min-w-[9.5rem] flex-1 basis-[9.5rem]">
                    <Link
                      href={ativo ? href(null) : href(i.c)}
                      aria-pressed={ativo}
                      scroll={false}
                      className={`block h-full rounded-lg border bg-slate-50/60 p-3 transition-colors duration-200 hover:border-[#6B4FBB]/60 focus-visible:outline-2 ${ativo ? "border-[#6B4FBB] bg-white ring-1 ring-[#6B4FBB]" : "border-slate-200"}`}
                    >
                      <span className="text-xs text-slate-600">{i.nome}</span>
                      <span className="mt-0.5 block text-lg font-semibold tabular-nums" style={{ color: COR_TOM[i.tom ?? "neutro"] }}>{brl(tot.valor)}</span>
                      <span className="mt-0.5 block text-[0.6875rem] leading-snug text-slate-600">{tot.quantidade} emenda(s) · {i.apoio}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {cartao && (
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white" aria-label={`Emendas: ${NOME_CARTAO[cartao]}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <h2 className="text-sm font-semibold text-cataguases-marinho">{NOME_CARTAO[cartao]} · {lista.length} emenda(s)</h2>
            <Link href={href(null)} scroll={false} className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-900">Limpar seleção</Link>
          </div>
          {lista.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">Nenhuma emenda nesse recorte.</p>
          ) : (
            <table className="w-full min-w-[860px] border-collapse text-[0.8125rem]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Emenda</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Valor</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Empenhado</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Pago</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Sem empenhar</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">A pagar</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="px-3.5 py-2">
                      <Link href={`/emendas/${l.id}?aba=financeiro`} className="font-medium text-[#5B3FA8] underline-offset-2 hover:underline">Nº {l.numero}</Link>
                      <div className="max-w-[280px] truncate text-xs text-slate-500" title={l.objeto}>{l.secretaria_nome} · {l.beneficiario_nome || l.objeto}</div>
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.valor)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.empenhado)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.pago)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{l.semEmpenhar ? brl(l.semEmpenhar) : "—"}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{l.aPagar ? brl(l.aPagar) : "—"}</td>
                    <td className="px-3.5 py-2">
                      {l.encerramento ? (
                        <>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${COR_SITUACAO[l.encerramento].selo}`}>{rotuloSituacao(l.encerramento, l.tipo_execucao)}</span>
                          <div className="mt-0.5 text-xs text-slate-500">em {dataBr(l.encerradaEm)}{l.devolucao ? ` · devolvido ${brl(l.devolucao)}` : ""}</div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">Sem situação definida</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {restosAnteriores.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-blue-200 bg-white" aria-label="Restos a pagar de exercícios anteriores">
          <table className="w-full min-w-[640px] border-collapse text-[0.8125rem]">
            <caption className="border-b border-slate-100 px-3.5 py-2.5 text-left text-sm font-semibold text-cataguases-marinho">
              Restos a pagar de exercícios anteriores · {brl(restosAnteriores.reduce((s, l) => s + l.aPagar, 0))} em {restosAnteriores.length} emenda(s)
              <span className="mt-0.5 block text-xs font-normal text-slate-500">Continuam pertencendo ao exercício de origem; os pagamentos feitos agora são lançados nelas. Quando o empenho for todo pago, passam sozinhas a cumpridas.</span>
            </caption>
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th scope="col" className="px-3.5 py-2 font-medium">Exercício</th>
                <th scope="col" className="px-3.5 py-2 font-medium">Emenda</th>
                <th scope="col" className="px-3.5 py-2 font-medium">Secretaria</th>
                <th scope="col" className="px-3.5 py-2 text-right font-medium">Empenhado</th>
                <th scope="col" className="px-3.5 py-2 text-right font-medium">Pago</th>
                <th scope="col" className="px-3.5 py-2 text-right font-medium">A pagar</th>
              </tr>
            </thead>
            <tbody>
              {restosAnteriores.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3.5 py-2 tabular-nums">{l.ano}</td>
                  <td className="px-3.5 py-2"><Link href={`/emendas/${l.id}?aba=financeiro`} className="font-medium text-[#5B3FA8] underline-offset-2 hover:underline">Nº {l.numero}</Link></td>
                  <td className="px-3.5 py-2">{l.secretaria_nome}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.empenhado)}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.pago)}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.aPagar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Quadro por grupo">
        <nav aria-label="Agrupar por" className="flex flex-wrap gap-1 border-b border-slate-200 px-2">
          {QUADROS.map((x) => (
            <Link
              key={x.chave}
              href={href(cartao, x.chave)}
              scroll={false}
              aria-current={quadro === x.chave ? "page" : undefined}
              className={`relative inline-flex min-h-11 items-center px-3 text-sm sm:min-h-10 ${quadro === x.chave ? "font-semibold text-cataguases-marinho" : "font-medium text-slate-600 hover:text-cataguases-marinho"}`}
            >
              {x.rotulo}
              {quadro === x.chave && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} aria-hidden />}
            </Link>
          ))}
        </nav>
        <Quadro linhas={linhasDoQuadro} />
      </section>
    </div>
  );
}

function Quadro({ linhas }: { linhas: ReturnType<typeof agrupar> }) {
  if (linhas.length === 0) return <p className="p-4 text-sm text-slate-600">Nada a mostrar neste recorte.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[0.8125rem]">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600">
            <th scope="col" className="px-3.5 py-2 font-medium">Nome</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Emendas</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Valor</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Empenhado</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Pago</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Sem empenhar</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Restos a pagar</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Cumpridas</th>
            <th scope="col" className="px-3.5 py-2 text-right font-medium">Sem situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((r) => (
            <tr key={r.chave} className="border-t border-slate-100">
              <th scope="row" className="px-3.5 py-2 text-left font-medium text-cataguases-marinho">{r.nome}</th>
              <td className="px-3.5 py-2 text-right tabular-nums">{r.emendas}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{brl(r.valor)}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{brl(r.empenhado)}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{brl(r.pago)}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{r.semEmpenhar ? brl(r.semEmpenhar) : "—"}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{r.restos ? brl(r.restos) : "—"}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{r.cumpridas}</td>
              <td className="px-3.5 py-2 text-right tabular-nums">{r.semSituacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
