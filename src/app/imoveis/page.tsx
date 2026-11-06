import Link from "next/link";

import { GraficoLinhas, LegendaSeries, type Serie } from "@/components/imoveis/graficos";
import { Cartao, SeloGravidade, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { brl, referenciaDe, rotuloMes, situacaoVigencia, totaisMensais } from "@/lib/imoveis/regras";

export const metadata = { title: "Painel · Imóveis e Consumo" };

export default async function PainelImoveis() {
  const { imoveis, unidades, contas, secretarias, pendencias, par, hoje } = await carregarTudo();
  const mesAtual = referenciaDe(hoje);
  // Mês de referência dos números: a conta mais recente lançada (sem passar do mês corrente).
  const refDados = contas.map((c) => c.referencia).filter((r) => r <= mesAtual).sort().at(-1) ?? mesAtual;

  const emUso = imoveis.filter((i) => i.situacao !== "entregue");
  const aluguelMes = emUso.reduce((a, i) => a + i.valor_aluguel, 0);
  const tipoDe = new Map(unidades.map((u) => [u.id, u.tipo]));
  const imovelDe = new Map(unidades.map((u) => [u.id, u.imovel_id]));
  const doMes = contas.filter((c) => c.referencia === refDados);
  const soma = (t: "agua" | "luz") => doMes.filter((c) => tipoDe.get(c.unidade_id) === t).reduce((a, c) => a + c.valor, 0);
  const agua = soma("agua");
  const luz = soma("luz");
  const vencendo = emUso.filter((i) => {
    const v = situacaoVigencia(i.vigencia_fim, hoje, par);
    return v.nivel === "critico" || v.nivel === "atencao" || v.nivel === "vencido";
  }).length;
  const criticas = pendencias.filter((p) => p.nivel === "critico").length;

  const mensais = totaisMensais(imoveis, unidades, contas, refDados, 12);
  const series: Serie[] = [
    { rotulo: "Aluguel", cor: "#0E7490", valores: mensais.map((m) => m.aluguel) },
    { rotulo: "Luz", cor: "#D98E04", valores: mensais.map((m) => m.luz) },
    { rotulo: "Água", cor: "#2B7BC0", valores: mensais.map((m) => m.agua) },
  ];

  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const porSec = new Map<string, { nome: string; aluguel: number; agua: number; luz: number }>();
  for (const i of emUso) {
    const e = porSec.get(i.secretaria_id) ?? { nome: nomeSecretaria.get(i.secretaria_id) ?? "—", aluguel: 0, agua: 0, luz: 0 };
    e.aluguel += i.valor_aluguel;
    porSec.set(i.secretaria_id, e);
  }
  for (const c of doMes) {
    const im = imoveis.find((i) => i.id === imovelDe.get(c.unidade_id));
    if (!im) continue;
    const e = porSec.get(im.secretaria_id) ?? { nome: nomeSecretaria.get(im.secretaria_id) ?? "—", aluguel: 0, agua: 0, luz: 0 };
    if (tipoDe.get(c.unidade_id) === "agua") e.agua += c.valor;
    else e.luz += c.valor;
    porSec.set(im.secretaria_id, e);
  }
  const ranking = [...porSec.values()].sort((a, b) => b.aluguel + b.agua + b.luz - (a.aluguel + a.agua + a.luz));
  const maior = Math.max(1, ...ranking.map((r) => r.aluguel + r.agua + r.luz));
  const nomeImovel = new Map(imoveis.map((i) => [i.id, i.nome]));

  if (imoveis.length === 0) {
    return (
      <>
        <TituloPagina titulo="Painel" subtitulo="Aluguéis, contas de água e luz e entrega dos imóveis." />
        <Cartao>
          <Vazio>Nenhum imóvel cadastrado ainda. Use “Imóveis” no menu para cadastrar o primeiro.</Vazio>
        </Cartao>
      </>
    );
  }

  return (
    <>
      <TituloPagina titulo="Painel" subtitulo={`Aluguéis e contas até ${rotuloMes(refDados)}, com o que precisa de ação.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: `Gasto do mês (${rotuloMes(refDados)})`, valor: brl(aluguelMes + agua + luz), dica: `aluguel ${brl(aluguelMes)}` },
          { rotulo: "Imóveis em uso", valor: String(emUso.length), dica: `${imoveis.length - emUso.length} já entregue(s)` },
          { rotulo: "Contratos vencendo ou vencidos", valor: String(vencendo), dica: `aviso com ${par.dias_fim_contrato} dias`, tom: vencendo ? "text-amber-700" : "" },
          { rotulo: "Pendências críticas", valor: String(criticas), dica: `${pendencias.length} abertas no total`, tom: criticas ? "text-red-700" : "" },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-600">{k.rotulo}</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight tabular-nums text-cataguases-marinho ${k.tom ?? ""}`}>{k.valor}</p>
            <p className="mt-0.5 text-xs text-slate-500">{k.dica}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Cartao titulo="Gasto mensal, últimos 12 meses">
          <LegendaSeries series={series} />
          <GraficoLinhas rotulos={mensais.map((m) => rotuloMes(m.referencia).slice(0, 3))} series={series} />
        </Cartao>
        <Cartao titulo="Por secretaria" apoio={rotuloMes(refDados)}>
          {ranking.length === 0 ? (
            <Vazio>Sem dados.</Vazio>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ranking.map((r) => {
                const total = r.aluguel + r.agua + r.luz;
                return (
                  <li key={r.nome} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-2.5 text-sm">
                    <span className="truncate" title={r.nome}>
                      {r.nome}
                    </span>
                    <span className="flex h-3.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${r.nome}: aluguel ${brl(r.aluguel)}, luz ${brl(r.luz)}, água ${brl(r.agua)}`}>
                      <span style={{ width: `${(r.aluguel / maior) * 100}%`, background: "#0E7490" }} />
                      <span style={{ width: `${(r.luz / maior) * 100}%`, background: "#D98E04" }} />
                      <span style={{ width: `${(r.agua / maior) * 100}%`, background: "#2B7BC0" }} />
                    </span>
                    <span className="tabular-nums text-slate-700">{brl(total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>

      <Cartao
        className="mt-4"
        titulo="Precisa de atenção"
        acao={
          <Link href="/imoveis/pendencias" className="text-sm font-medium text-[color:var(--modulo-tinta)] hover:underline">
            Ver todas
          </Link>
        }
      >
        {pendencias.length === 0 ? (
          <Vazio>Nenhuma pendência no momento.</Vazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendencias.slice(0, 6).map((p) => (
              <li key={`${p.imovelId}-${p.chave}`} className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 border-l-4 px-3 py-2.5 ${p.nivel === "critico" ? "border-l-red-600" : "border-l-amber-500"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <b>{nomeImovel.get(p.imovelId)}</b> · {p.titulo}
                  </p>
                  <p className="text-[13px] text-slate-600">{p.detalhe}</p>
                </div>
                <div className="flex items-center gap-2">
                  <SeloGravidade nivel={p.nivel} />
                  <Link href={`/imoveis/imoveis/${p.imovelId}`} className="text-sm font-medium text-[color:var(--modulo-tinta)] hover:underline">
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}
