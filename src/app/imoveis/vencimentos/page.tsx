import Link from "next/link";

import { SeloDias, SeloGravidade, TituloPagina } from "@/components/imoveis/ui";
import { CARTAO, Titulo } from "@/components/modulo/painel-abertura-ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { brl, diasEntre, formatarData, proximoVencimentoAluguel, rotuloMes, ROTULO_TIPO, situacaoVigencia } from "@/lib/imoveis/regras";
import { cn } from "@/lib/utils";

export const metadata = { title: "Vencimentos · Imóveis e Consumo" };

/** Cartão de lista do Vencimentos: as linhas esticam até a altura do cartão vizinho, sem sobra em branco. */
function Lista({ titulo, vazio, children, i }: { titulo: string; vazio: string; children: React.ReactNode[]; i: number }) {
  return (
    <section aria-label={titulo} className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: i }}>
      <Titulo>{titulo}</Titulo>
      {children.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-600">{vazio}</p>
      ) : (
        <ul className="mt-2 flex flex-1 flex-col text-sm">{children}</ul>
      )}
    </section>
  );
}

const LI = "flex flex-1 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0";

export default async function VencimentosImoveis() {
  const t = await carregarTudo();
  const { hoje, par } = t;
  const emUso = t.imoveis.filter((i) => i.situacao !== "entregue");

  const alugueis = emUso
    .map((i) => ({ i, data: proximoVencimentoAluguel(i.dia_vencimento, hoje) }))
    .filter((x): x is { i: (typeof emUso)[number]; data: string } => !!x.data)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 12);
  const fins = emUso.filter((i) => i.vigencia_fim).sort((a, b) => (a.vigencia_fim as string).localeCompare(b.vigencia_fim as string)).slice(0, 12);
  const reajustes = emUso.filter((i) => i.proximo_reajuste && diasEntre(hoje, i.proximo_reajuste) >= -30 && diasEntre(hoje, i.proximo_reajuste) <= 120).sort((a, b) => (a.proximo_reajuste as string).localeCompare(b.proximo_reajuste as string)).slice(0, 12);
  const unidadePorId = new Map(t.unidades.map((u) => [u.id, u]));
  const nomeImovel = new Map(t.imoveis.map((i) => [i.id, i.nome]));
  const abertas = t.contas
    .filter((c) => !c.pago_em && c.vencimento)
    .sort((a, b) => (a.vencimento as string).localeCompare(b.vencimento as string))
    .slice(0, 12);

  return (
    <>
      <TituloPagina titulo="Vencimentos" />
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Lista i={0} titulo="Próximos aluguéis" vazio="Nenhum imóvel com dia de vencimento cadastrado.">
          {alugueis.map(({ i, data }) => (
            <li key={i.id} className={LI}>
              <span className="min-w-0">
                <Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">
                  {i.nome}
                </Link>
                <span className="block text-xs text-slate-500">{formatarData(data)}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {brl(i.valor_aluguel)}
                {diasEntre(hoje, data) <= 5 && <SeloDias dias={diasEntre(hoje, data)} nivel="atencao" />}
              </span>
            </li>
          ))}
        </Lista>
        <Lista i={1} titulo="Fim de contrato" vazio="Nenhum contrato com data de fim.">
          {fins.map((i) => {
            const v = situacaoVigencia(i.vigencia_fim, hoje, par);
            return (
              <li key={i.id} className={LI}>
                <span className="min-w-0">
                  <Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">
                    {i.nome}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {formatarData(i.vigencia_fim)}
                    {i.indice_reajuste ? ` · reajuste ${i.indice_reajuste}` : ""}
                  </span>
                </span>
                {v.nivel === "vencido" ? <SeloGravidade nivel="critico" /> : v.dias !== null ? <SeloDias dias={v.dias} nivel={v.nivel === "ok" ? "ok" : v.nivel === "critico" ? "critico" : "atencao"} /> : null}
              </li>
            );
          })}
        </Lista>
        <Lista i={2} titulo="Contas em aberto" vazio="Nenhuma conta em aberto.">
          {abertas.map((c) => {
            const u = unidadePorId.get(c.unidade_id);
            const dias = diasEntre(c.vencimento as string, hoje);
            return (
              <li key={c.id} className={LI}>
                <span className="min-w-0">
                  <span className="font-medium">{u ? nomeImovel.get(u.imovel_id) : "—"}</span>
                  <span className="block text-xs text-slate-500">
                    {u ? ROTULO_TIPO[u.tipo] : ""} · {rotuloMes(c.referencia)} · vence {formatarData(c.vencimento)}
                  </span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  {brl(c.valor)}
                  {dias > par.dias_atraso && <SeloGravidade nivel="atencao" />}
                </span>
              </li>
            );
          })}
        </Lista>
        <Lista i={3} titulo="Reajustes" vazio="Nenhum reajuste previsto nos próximos meses.">
          {reajustes.map((i) => (
            <li key={i.id} className={LI}>
              <span className="min-w-0">
                <Link href={`/imoveis/imoveis/${i.id}`} className="font-medium hover:underline">
                  {i.nome}
                </Link>
                <span className="block text-xs text-slate-500">{i.indice_reajuste ?? "índice não informado"}</span>
              </span>
              <span className="tabular-nums">{formatarData(i.proximo_reajuste)}</span>
            </li>
          ))}
        </Lista>
      </div>
    </>
  );
}
