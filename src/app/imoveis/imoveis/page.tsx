import Link from "next/link";

import { SeloGravidade, SeloSituacaoImovel, Cartao, CLASSE_BOTAO, SeloDias, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { filtrarImoveis, lerFiltroImoveis } from "@/lib/imoveis/filtros";
import { brl, formatarData, referenciaDe, situacaoVigencia } from "@/lib/imoveis/regras";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

export const metadata = { title: "Imóveis · Imóveis e Consumo" };

export default async function ListaImoveis({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filtro = lerFiltroImoveis(await searchParams);
  const ctx = await obterContextoImoveis();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const { imoveis, unidades, contas, secretarias, imobiliarias, pendencias, par, hoje } = await carregarTudo();

  const comAlerta = new Set(pendencias.map((p) => p.imovelId));
  const lista = filtrarImoveis(imoveis, filtro, comAlerta);
  const nomeSec = new Map(secretarias.map((s) => [s.id, s.nome]));
  const nomeImob = new Map(imobiliarias.map((i) => [i.id, i.nome]));
  const mesAtual = referenciaDe(hoje);
  const refDados = contas.map((c) => c.referencia).filter((r) => r <= mesAtual).sort().at(-1) ?? mesAtual;
  const tipoDe = new Map(unidades.map((u) => [u.id, u.tipo]));
  const imovelDe = new Map(unidades.map((u) => [u.id, u.imovel_id]));
  const valorMes = (id: string, t: "agua" | "luz") =>
    contas.filter((c) => c.referencia === refDados && imovelDe.get(c.unidade_id) === id && tipoDe.get(c.unidade_id) === t).reduce((a, c) => a + c.valor, 0);
  const total = lista.reduce((a, i) => a + i.valor_aluguel, 0);

  return (
    <>
      <TituloPagina
        titulo="Imóveis"
        subtitulo="Todos os imóveis alugados pela Prefeitura, com contrato, proprietário, contas de água e luz e situação."
        acao={gestor ? <Link href="/imoveis/imoveis/novo" className={CLASSE_BOTAO}>Novo imóvel</Link> : undefined}
      />
      <Cartao semPadding>
        <FormularioFiltros
          className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5"
          limpar={{ href: "/imoveis/imoveis", className: CLASSE_BOTAO_SECUNDARIO }}
        >
          <div className="flex min-w-[220px] flex-[2] flex-col gap-1">
            <label htmlFor="f-q" className="text-xs font-semibold text-slate-600">Buscar</label>
            <input id="f-q" name="q" defaultValue={filtro.q} placeholder="Nome, endereço, contrato ou proprietário" className={ESTILO_CAMPO_PADRAO} />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col gap-1">
            <label htmlFor="f-sec" className="text-xs font-semibold text-slate-600">Secretaria</label>
            <select id="f-sec" name="sec" defaultValue={filtro.secretaria ?? ""} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              {secretarias.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label htmlFor="f-sit" className="text-xs font-semibold text-slate-600">Situação</label>
            <select id="f-sit" name="sit" defaultValue={filtro.situacao ?? ""} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              <option value="ativo">Ativo</option>
              <option value="em_entrega">Em entrega</option>
              <option value="entregue">Entregue</option>
            </select>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="alerta" value="1" defaultChecked={filtro.alerta} />
            Só com pendência
          </label>
        </FormularioFiltros>

        {lista.length === 0 ? (
          <Vazio>{imoveis.length === 0 ? "Nenhum imóvel cadastrado ainda." : "Nenhum imóvel encontrado com esses filtros."}</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  {["Imóvel", "Secretaria", "Situação", "Aluguel", "Vigência", "Água (mês)", "Luz (mês)", "Alertas"].map((t) => <th key={t} scope="col" className="px-4 py-2.5 first:sm:pl-5">{t}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((i) => {
                  const v = situacaoVigencia(i.vigencia_fim, hoje, par);
                  const pend = pendencias.filter((p) => p.imovelId === i.id);
                  const piorCritico = pend.some((p) => p.nivel === "critico");
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 first:sm:pl-5">
                        <Link href={`/imoveis/imoveis/${i.id}`} className="font-semibold text-cataguases-marinho hover:underline">{i.nome}</Link>
                        <div className="text-xs text-slate-500">{i.endereco}{i.imobiliaria_id ? ` · ${nomeImob.get(i.imobiliaria_id) ?? ""}` : ""}</div>
                      </td>
                      <td className="px-4 py-3">{nomeSec.get(i.secretaria_id) ?? "—"}</td>
                      <td className="px-4 py-3"><SeloSituacaoImovel situacao={i.situacao} /></td>
                      <td className="px-4 py-3 tabular-nums">{brl(i.valor_aluguel)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatarData(i.vigencia_fim)}
                        {i.situacao !== "entregue" && v.dias !== null && v.nivel !== "ok" && (
                          <div className="mt-0.5">{v.nivel === "vencido" ? <SeloGravidade nivel="critico" /> : <SeloDias dias={v.dias} nivel={v.nivel === "critico" ? "critico" : "atencao"} />}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{valorMes(i.id, "agua") ? brl(valorMes(i.id, "agua")) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{valorMes(i.id, "luz") ? brl(valorMes(i.id, "luz")) : "—"}</td>
                      <td className="px-4 py-3">{pend.length ? <SeloGravidade nivel={piorCritico ? "critico" : "atencao"} /> : <span className="text-slate-400">—</span>}{pend.length > 1 && <span className="ml-1 text-xs text-slate-500">{pend.length}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 text-xs font-semibold text-slate-700">
                <tr><td className="px-4 py-2.5 sm:pl-5" colSpan={3}>{lista.length} imóvel(is)</td><td className="px-4 py-2.5 tabular-nums">{brl(total)}</td><td colSpan={4} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </Cartao>
    </>
  );
}
