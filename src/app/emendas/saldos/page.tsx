import Link from "next/link";
import { Download, Scale } from "lucide-react";

import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { Vazio } from "@/components/emendas/ui";
import { listarConciliacoes, listarEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { brl, dataBr } from "@/lib/emendas/regras";
import { linhasDeSaldo, porSecretaria, temTipo, totaisDeSaldo, type TipoSaldo } from "@/lib/emendas/saldos";

export const dynamic = "force-dynamic";

const TIPOS: { v: TipoSaldo; nome: string }[] = [
  { v: "registrar", nome: "Saldo a registrar" },
  { v: "registrado", nome: "Saldo registrado" },
  { v: "anular", nome: "Empenho a anular" },
  { v: "excesso", nome: "Excesso sobre a emenda" },
];
const CAMPO_FILTRO = "h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB] sm:h-[38px]";

/**
 * Saldos de todas as emendas do exercício, para a Contabilidade: saldo não executado (registrado e a registrar), saldo do empenho
 * a anular no IPM e excesso sobre o valor da emenda (com a fonte). Cada pessoa vê o que a RLS libera.
 */
export default async function PaginaSaldos({ searchParams }: { searchParams: Promise<{ ano?: string; s?: string; k?: string }> }) {
  const { ano, s, k } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const emendas = await listarEmendas(exercicio.ano);
  const conciliacoes = await listarConciliacoes(emendas.map((e) => e.id));
  const todas = linhasDeSaldo(emendas, conciliacoes);
  const filtradas = todas.filter((l) => (!s || l.secretariaId === s) && (!k || temTipo(l, k as TipoSaldo)));
  const t = totaisDeSaldo(filtradas);
  const secretarias = new Map(todas.map((l) => [l.secretariaId, l.secretaria]));
  const resumo = porSecretaria(filtradas);
  const naoExecutado = t.naoExecutadoRegistrado + t.naoExecutadoARegistrar;
  const exportar = `/emendas/saldos/exportar?${new URLSearchParams({ ano: String(exercicio.ano), ...(s ? { s } : {}), ...(k ? { k } : {}) }).toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-cataguases-marinho">
            <Scale className="h-6 w-6 text-[#5B3FA8]" aria-hidden /> Saldos e conciliação com o IPM · {exercicio.ano}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Valor contábil exato (sem arredondamento). Aqui estão os saldos que a Contabilidade precisa acompanhar: o que não foi executado, o que falta anular nos empenhos e o que passou do valor da emenda.
          </p>
        </div>
        <a href={exportar} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-cataguases-marinho transition-colors duration-200 hover:bg-slate-50 sm:min-h-9">
          <Download className="h-4 w-4" aria-hidden /> Baixar Excel
        </a>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Saldo não executado", brl(naoExecutado), `${brl(t.naoExecutadoRegistrado)} registrado · ${brl(t.naoExecutadoARegistrar)} a registrar`, "#B45309"],
          ["Empenho a anular no IPM", brl(t.empenhoAAnular), `${t.qtdAnular} emenda(s) · ${brl(t.anularSolicitado)} já solicitado`, "#B45309"],
          ["Excesso sobre a emenda", brl(t.excesso), t.qtdExcesso ? `${brl(t.excessoSemFonte)} sem fonte informada` : "nenhum caso", t.excessoSemFonte ? "#B91C1C" : "#0C1D33"],
          ["Emendas com saldo", String(t.emendas), `de ${emendas.filter((e) => e.situacao !== "cancelada").length} emendas`, "#0C1D33"],
        ].map(([rotulo, valor, apoio, cor]) => (
          <div key={rotulo} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <dt className="text-xs text-slate-500">{rotulo}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color: cor }}>{valor}</dd>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{apoio}</p>
          </div>
        ))}
      </dl>

      <FormularioFiltros className="flex flex-wrap items-center gap-2" limpar={{ href: `/emendas/saldos?ano=${exercicio.ano}`, className: "text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900", visivel: !!(s || k) }}>
        <input type="hidden" name="ano" value={exercicio.ano} />
        <label className="sr-only" htmlFor="f-sec">Secretaria</label>
        <select id="f-sec" name="s" defaultValue={s ?? ""} className={CAMPO_FILTRO}>
          <option value="">Todas as secretarias</option>
          {[...secretarias.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="f-tipo">Tipo de saldo</label>
        <select id="f-tipo" name="k" defaultValue={k ?? ""} className={CAMPO_FILTRO}>
          <option value="">Todos os tipos</option>
          {TIPOS.map((x) => (
            <option key={x.v} value={x.v}>{x.nome}</option>
          ))}
        </select>
      </FormularioFiltros>

      {filtradas.length === 0 ? (
        <Vazio>Nenhuma emenda com saldo para conciliar{s || k ? " nesse filtro" : ""}.</Vazio>
      ) : (
        <>
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white" aria-label="Por secretaria">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <caption className="sr-only">Saldos por secretaria</caption>
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Secretaria</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Emendas</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Não executado</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Empenho a anular</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Excesso</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => (
                  <tr key={r.secretaria} className="border-t border-slate-100">
                    <th scope="row" className="px-3.5 py-2 text-left font-medium text-cataguases-marinho">{r.secretaria}</th>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.emendas}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.naoExecutado ? brl(r.naoExecutado) : "—"}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.empenhoAAnular ? brl(r.empenhoAAnular) : "—"}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.excesso ? brl(r.excesso) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white" aria-label="Por emenda">
            <table className="w-full min-w-[920px] border-collapse text-[13px]">
              <caption className="sr-only">Saldos por emenda</caption>
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Emenda</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Valor</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Empenhado</th>
                  <th scope="col" className="px-3.5 py-2.5 text-right font-medium">Pago</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Saldo não executado</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Empenho a anular</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Excesso</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="px-3.5 py-2">
                      <Link href={`/emendas/${l.id}?aba=financeiro`} className="font-medium text-[#5B3FA8] underline-offset-2 hover:underline">Nº {l.numero}</Link>
                      <div className="max-w-[260px] truncate text-xs text-slate-500" title={l.objeto}>{l.secretaria} · {l.beneficiario || l.objeto}</div>
                    </td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.valor)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.empenhado)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{brl(l.pago)}</td>
                    <td className="px-3.5 py-2">
                      {l.naoExecutado > 0 ? (
                        <>
                          <span className="font-medium tabular-nums">{brl(l.naoExecutado)}</span>
                          <Estado ok={l.naoExecutadoRegistrado} sim={`Registrado em ${dataBr(l.registradoEm)}`} nao="A registrar" />
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3.5 py-2">
                      {l.empenhoAAnular > 0 ? (
                        <>
                          <span className="font-medium tabular-nums">{brl(l.empenhoAAnular)}</span>
                          <Estado ok={!!l.anulacaoSolicitadaEm} sim={`Solicitada em ${dataBr(l.anulacaoSolicitadaEm)}${l.anulacaoDocumento ? ` · ${l.anulacaoDocumento}` : ""}`} nao="A solicitar" />
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3.5 py-2">
                      {l.excesso > 0 || l.excessoFonte ? (
                        <>
                          <span className="font-medium tabular-nums">{brl(l.excesso)}</span>
                          <Estado ok={!!l.excessoFonte} sim={`Fonte: ${l.excessoFonte}`} nao="Sem fonte de recurso" />
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-cataguases-marinho">
                  <th scope="row" className="px-3.5 py-2.5 text-left">Total ({filtradas.length})</th>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{brl(filtradas.reduce((x, l) => x + l.valor, 0))}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{brl(filtradas.reduce((x, l) => x + l.empenhado, 0))}</td>
                  <td className="px-3.5 py-2.5 text-right tabular-nums">{brl(filtradas.reduce((x, l) => x + l.pago, 0))}</td>
                  <td className="px-3.5 py-2.5 tabular-nums">{brl(naoExecutado)}</td>
                  <td className="px-3.5 py-2.5 tabular-nums">{brl(t.empenhoAAnular)}</td>
                  <td className="px-3.5 py-2.5 tabular-nums">{brl(t.excesso)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

/** Estado em texto + cor (a cor sozinha não basta). */
function Estado({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return <div className={`mt-0.5 text-xs ${ok ? "text-green-800" : "text-amber-800"}`}>{ok ? "✓ " : "• "}{ok ? sim : nao}</div>;
}
