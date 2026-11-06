import Link from "next/link";

import { FormularioConta, type OpcaoUnidade } from "@/components/imoveis/formulario-conta";
import { GraficoLinhas } from "@/components/imoveis/graficos";
import { MenuExportarImoveis } from "@/components/imoveis/menu-exportar-imoveis";
import { Cartao, SeloGravidade, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { linhasConsolidadas } from "@/lib/imoveis/consolidado";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { brl, referenciaDe, rotuloMes, ROTULO_TIPO, UNIDADE_DE_MEDIDA, ultimosMeses } from "@/lib/imoveis/regras";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import type { TipoUnidade } from "@/types/imoveis";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Área consolidada de água ou luz: todas as contas da Prefeitura (cada uma também aparece dentro do imóvel). */
export async function ConsolidadoContas({ tipo, searchParams }: { tipo: TipoUnidade; searchParams: Busca }) {
  const t = await carregarTudo();
  const ctx = await obterContextoImoveis();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const un = UNIDADE_DE_MEDIDA[tipo];
  const nome = ROTULO_TIPO[tipo];
  const cor = tipo === "agua" ? "#2B7BC0" : "#D98E04";

  const mesAtual = referenciaDe(t.hoje);
  const mesesComDado = [...new Set(t.contas.filter((c) => t.unidades.find((u) => u.id === c.unidade_id)?.tipo === tipo).map((c) => c.referencia))].sort().reverse();
  const refPadrao = mesesComDado.find((r) => r <= mesAtual) ?? mesAtual;
  const pedido = um(searchParams.mes);
  const referencia = mesesComDado.includes(pedido) ? pedido : refPadrao;
  const sec = um(searchParams.sec) || null;
  const soAnomalia = um(searchParams.anomalia) === "1";

  const todas = linhasConsolidadas(tipo, referencia, t.imoveis, t.unidades, t.contas, t.par);
  const linhas = todas
    .filter((l) => (!sec || l.imovel.secretaria_id === sec) && (!soAnomalia || l.anomalias.length > 0))
    .sort((a, b) => (b.conta?.valor ?? 0) - (a.conta?.valor ?? 0));
  const nomeSec = new Map(t.secretarias.map((s) => [s.id, s.nome]));

  const doMes = linhas.filter((l) => l.conta);
  const totalValor = doMes.reduce((a, l) => a + (l.conta?.valor ?? 0), 0);
  const totalConsumo = doMes.reduce((a, l) => a + (l.conta?.consumo ?? 0), 0);
  const meses = ultimosMeses(referencia, 12);
  const idsVisiveis = new Set(linhas.map((l) => l.unidade.id));
  const porMes = meses.map((m) => t.contas.filter((c) => c.referencia === m && idsVisiveis.has(c.unidade_id)).reduce((a, c) => a + c.valor, 0));
  const totalAno = porMes.reduce((a, v) => a + v, 0);
  const comAnomalia = todas.filter((l) => l.anomalias.length > 0).length;
  const semConta = linhas.filter((l) => !l.conta && l.unidade.ativa && l.imovel.situacao === "ativo").length;

  const opcoes: OpcaoUnidade[] = t.unidades
    .filter((u) => u.tipo === tipo)
    .map((u) => ({
      id: u.id,
      tipo,
      rotulo: `${t.imoveis.find((i) => i.id === u.imovel_id)?.nome ?? "—"} · ${u.numero}`,
      historico: t.contas.filter((c) => c.unidade_id === u.id).map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor })),
    }));

  return (
    <>
      <TituloPagina
        titulo={`${nome}: consolidado`}
        subtitulo={`Todas as contas de ${nome.toLowerCase()} da Prefeitura. Cada conta também aparece dentro do imóvel a que pertence.`}
        acao={
          <>
            <MenuExportarImoveis relatorios={[{ r: "contas", rotulo: "Contas de água e luz" }]} />
            {gestor && <Link href="/imoveis/importar" className={CLASSE_BOTAO_SECUNDARIO}>Importar PDF</Link>}
          </>
        }
      />

      {gestor && opcoes.length > 0 && (
        <details className="mb-4 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[color:var(--modulo-tinta)] sm:px-5">Lançar conta de {nome.toLowerCase()}</summary>
          <div className="border-t border-slate-100 p-4 sm:p-5">
            <FormularioConta conta={null} unidades={opcoes} par={t.par} mesPadrao={refPadrao} />
          </div>
        </details>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [`Valor de ${rotuloMes(referencia)}`, brl(totalValor), ""],
          ["Consumo do mês", `${Math.round(totalConsumo).toLocaleString("pt-BR")} ${un}`, ""],
          ["Contas em 12 meses", brl(totalAno), "na seleção"],
          ["Contas com anomalia", String(comAnomalia), semConta ? `${semConta} sem conta no mês` : ""],
        ].map(([r, v, d]) => (
          <div key={r} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-xs font-medium text-slate-600">{r}</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums text-cataguases-marinho">{v}</p>
            {d && <p className="text-xs text-slate-500">{d}</p>}
          </div>
        ))}
      </div>

      <Cartao titulo="Valor mensal" className="mb-4">
        <GraficoLinhas rotulos={meses.map((m) => rotuloMes(m).slice(0, 3))} series={[{ rotulo: nome, cor, valores: porMes }]} altura={200} />
      </Cartao>

      <Cartao semPadding titulo={`Contas de ${rotuloMes(referencia)} por imóvel`}>
        <FormularioFiltros className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5" limpar={{ href: `/imoveis/${tipo}`, className: CLASSE_BOTAO_SECUNDARIO }}>
          <div className="flex min-w-[170px] flex-1 flex-col gap-1">
            <label htmlFor="f-sec" className="text-xs font-semibold text-slate-600">Secretaria</label>
            <select id="f-sec" name="sec" defaultValue={sec ?? ""} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              {t.secretarias.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label htmlFor="f-mes" className="text-xs font-semibold text-slate-600">Mês</label>
            <select id="f-mes" name="mes" defaultValue={referencia} className={ESTILO_CAMPO_PADRAO}>
              {(mesesComDado.length ? mesesComDado : [referencia]).map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
            </select>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="anomalia" value="1" defaultChecked={soAnomalia} />
            Só com anomalia
          </label>
        </FormularioFiltros>
        {linhas.length === 0 ? (
          <Vazio>{t.unidades.some((u) => u.tipo === tipo) ? "Nenhuma conta com esses filtros." : `Nenhuma unidade de ${nome.toLowerCase()} cadastrada. Adicione a matrícula ou UC dentro de cada imóvel.`}</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>{["Imóvel", "Secretaria", tipo === "agua" ? "Matrícula" : "UC", "Consumo", "Valor", "vs. média", "Situação"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 first:sm:pl-5">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => (
                  <tr key={l.unidade.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 first:sm:pl-5"><Link href={`/imoveis/imoveis/${l.imovel.id}?aba=contas`} className="font-semibold text-cataguases-marinho hover:underline">{l.imovel.nome}</Link></td>
                    <td className="px-4 py-3">{nomeSec.get(l.imovel.secretaria_id) ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.unidade.numero}</td>
                    <td className="px-4 py-3 tabular-nums">{l.conta?.consumo != null ? `${l.conta.consumo.toLocaleString("pt-BR")} ${un}` : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{l.conta ? brl(l.conta.valor) : "—"}</td>
                    <td className={`px-4 py-3 tabular-nums ${l.anomalias.some((a) => a.tipo === "acima") ? "font-semibold text-red-700" : ""}`}>{l.variacao === null ? "—" : `${l.variacao >= 0 ? "+" : ""}${Math.round(l.variacao)}%`}</td>
                    <td className="px-4 py-3">
                      {l.anomalias.length ? <SeloGravidade nivel={l.anomalias.some((a) => a.nivel === "critico") ? "critico" : "atencao"} /> : l.conta ? <span className="text-green-800">Normal</span> : <span className="text-slate-500">{l.imovel.situacao === "entregue" ? "Entregue" : "Sem conta"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  );
}
