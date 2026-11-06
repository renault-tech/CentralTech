import Link from "next/link";

import { Cartao, SeloDias, SeloGravidade, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { brl, diasEntre, formatarData, proximoVencimentoAluguel, rotuloMes, ROTULO_TIPO, situacaoVigencia } from "@/lib/imoveis/regras";

export const metadata = { title: "Vencimentos · Imóveis e Consumo" };

export default async function VencimentosImoveis() {
  const t = await carregarTudo();
  const { hoje, par } = t;
  const emUso = t.imoveis.filter((i) => i.situacao !== "entregue");

  const alugueis = emUso
    .map((i) => ({ i, data: proximoVencimentoAluguel(i.dia_vencimento, hoje) }))
    .filter((x): x is { i: (typeof emUso)[number]; data: string } => !!x.data)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 12);
  const fins = emUso.filter((i) => i.vigencia_fim).sort((a, b) => (a.vigencia_fim as string).localeCompare(b.vigencia_fim as string)).slice(0, 10);
  const reajustes = emUso.filter((i) => i.proximo_reajuste && diasEntre(hoje, i.proximo_reajuste) >= -30 && diasEntre(hoje, i.proximo_reajuste) <= 120).sort((a, b) => (a.proximo_reajuste as string).localeCompare(b.proximo_reajuste as string));
  const imovelDeUnidade = new Map(t.unidades.map((u) => [u.id, u]));
  const nomeImovel = new Map(t.imoveis.map((i) => [i.id, i.nome]));
  const abertas = t.contas
    .filter((c) => !c.pago_em && c.vencimento)
    .sort((a, b) => (a.vencimento as string).localeCompare(b.vencimento as string))
    .slice(0, 12);

  return (
    <>
      <TituloPagina titulo="Vencimentos" subtitulo="Aluguéis a pagar, contas em aberto, fim de contrato e reajustes." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Próximos aluguéis">
          {alugueis.length === 0 ? <Vazio>Nenhum imóvel com dia de vencimento cadastrado.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {alugueis.map(({ i, data }) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">{i.nome}</Link><span className="block text-xs text-slate-500">{formatarData(data)}</span></span>
                  <span className="flex items-center gap-2 tabular-nums">{brl(i.valor_aluguel)}{diasEntre(hoje, data) <= 5 && <SeloDias dias={diasEntre(hoje, data)} nivel="atencao" />}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Fim de contrato">
          {fins.length === 0 ? <Vazio>Nenhum contrato com data de fim.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {fins.map((i) => {
                const v = situacaoVigencia(i.vigencia_fim, hoje, par);
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">{i.nome}</Link><span className="block text-xs text-slate-500">{formatarData(i.vigencia_fim)}{i.indice_reajuste ? ` · reajuste ${i.indice_reajuste}` : ""}</span></span>
                    {v.nivel === "vencido" ? <SeloGravidade nivel="critico" /> : v.dias !== null ? <SeloDias dias={v.dias} nivel={v.nivel === "ok" ? "ok" : v.nivel === "critico" ? "critico" : "atencao"} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Contas em aberto">
          {abertas.length === 0 ? <Vazio>Nenhuma conta em aberto.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {abertas.map((c) => {
                const u = imovelDeUnidade.get(c.unidade_id);
                const dias = diasEntre(c.vencimento as string, hoje);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><span className="font-medium">{u ? nomeImovel.get(u.imovel_id) : "—"}</span><span className="block text-xs text-slate-500">{u ? ROTULO_TIPO[u.tipo] : ""} · {rotuloMes(c.referencia)} · vence {formatarData(c.vencimento)}</span></span>
                    <span className="flex items-center gap-2 tabular-nums">{brl(c.valor)}{dias > par.dias_atraso && <SeloGravidade nivel="atencao" />}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Reajustes">
          {reajustes.length === 0 ? <Vazio>Nenhum reajuste previsto nos próximos meses.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {reajustes.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">{i.nome}</Link><span className="block text-xs text-slate-500">{i.indice_reajuste ?? "índice não informado"}</span></span>
                  <span className="tabular-nums">{formatarData(i.proximo_reajuste)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
