import Link from "next/link";

import { Barra, Cartao, SeloNivel, TituloPagina, Vazio } from "@/components/frotas/ui";
import { ROTULO_PARECER, calcularAlertas, calcularIndicadores, custoPorVeiculo, gastoPorSecretaria } from "@/lib/frotas/analise";
import { listarManutencoes, listarNotas, listarSecretarias, listarVeiculos, obterParametros } from "@/lib/frotas/dados";
import { brl, pct } from "@/lib/frotas/regras";
import { dataNoFuso } from "@/lib/fuso";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { opcoesExportar } from "@/lib/frotas/exportacao";

export const metadata = { title: "Análise da frota · Frotas" };

export default async function PaginaAnalise() {
  const [veiculos, manutencoes, notas, secretarias, params] = await Promise.all([
    listarVeiculos(),
    listarManutencoes(),
    listarNotas(),
    listarSecretarias(),
    obterParametros(),
  ]);
  const entrada = { hoje: dataNoFuso(new Date()), veiculos, manutencoes, notas, secretarias, params };
  const ind = calcularIndicadores(entrada);
  const ranking = custoPorVeiculo(entrada);
  const gastos = gastoPorSecretaria(entrada);
  const alertas = calcularAlertas(entrada);
  const maior = Math.max(1, ...gastos.map((g) => g.manutencao + g.combustivel));
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const semValor = veiculos.filter((v) => v.vinculo !== "alugado" && v.valor_referencia === null).length;

  const kpis = [
    { r: "Manutenção em 12 meses", v: brl(ind.manutencao12m), n: "Serviços liberados" },
    { r: "Combustível em 12 meses", v: brl(ind.combustivel12m), n: "Soma das NFs quinzenais" },
    { r: `Acima de ${params.pct_atencao}% do valor`, v: String(ind.acimaAtencao), n: "Veículos em atenção" },
    { r: `Acima de ${params.pct_critico}% do valor`, v: String(ind.acimaCritico), n: "Candidatos a baixa ou troca" },
    { r: "Idade média da frota", v: ind.idadeMedia === null ? "—" : `${ind.idadeMedia.toFixed(1).replace(".", ",")} anos`, n: "Veículos e máquinas próprios" },
  ];

  return (
    <>
      <TituloPagina
        titulo="Análise da frota"
        subtitulo="Quanto cada veículo custa em manutenção comparado ao que ele vale, e onde o gasto está concentrado. Últimos 12 meses."
        acao={
          <MenuExportar
            opcoes={opcoesExportar([
              { r: "custo", rotulo: "Custo × valor do veículo", formatos: ["xlsx", "pdf", "csv"] },
              { r: "gasto-secretaria", rotulo: "Gasto por secretaria", formatos: ["xlsx", "pdf", "csv"] },
              { r: "completo", rotulo: "Tudo em uma planilha", formatos: ["xlsx"] },
            ])}
          />
        }
      />

      {semValor > 0 && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          {semValor} {semValor === 1 ? "veículo ainda não tem" : "veículos ainda não têm"} valor de referência e ficam de fora da comparação custo × valor.{" "}
          <Link href="/frotas/veiculos" className="font-semibold underline">Buscar na FIPE em Veículos</Link>
        </p>
      )}

      <section aria-label="Indicadores" className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.r} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-xs font-medium text-slate-600">{k.r}</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums tracking-tight text-cataguases-marinho">{k.v}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{k.n}</span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.3fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Cartao
            titulo="Manutenção em relação ao valor do veículo"
            apoio={`Atenção a partir de ${params.pct_atencao}%, avaliar baixa ou troca a partir de ${params.pct_critico}%`}
            semPadding
          >
            {ranking.length === 0 ? (
              <Vazio>Ainda não há manutenção liberada em veículo com valor de referência.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      {["Veículo", "Secretaria", "Valor FIPE", "Manutenção 12 m", "% do valor", "Parecer"].map((t) => (
                        <th key={t} scope="col" className="px-4 py-2.5 first:sm:pl-5">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((l) => (
                      <tr key={l.veiculo.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 sm:pl-5">
                          <Link href={`/frotas/veiculos?editar=${l.veiculo.id}`} className="font-semibold text-cataguases-marinho hover:underline">
                            {l.veiculo.placa ?? "Sem placa"}
                          </Link>
                          <span className="block text-xs text-slate-500">{l.veiculo.modelo} {l.veiculo.ano_modelo ?? ""}</span>
                        </td>
                        <td className="px-4 py-2.5">{nomeSecretaria.get(l.veiculo.secretaria_id) ?? "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums">{brl(l.valor)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{brl(l.custo12m)}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex min-w-[130px] items-center gap-2">
                            <span className="flex-1"><Barra valor={l.pct12m} nivel={l.nivel} marcaEm={params.pct_atencao} /></span>
                            <span className="w-11 text-right font-semibold tabular-nums">{pct(l.pct12m)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><SeloNivel nivel={l.nivel}>{ROTULO_PARECER[l.parecer]}</SeloNivel></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          <Cartao
            titulo="Gasto por secretaria"
            acao={
              <span className="flex gap-4 text-xs text-slate-700">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-sm bg-[#3F5A12]" />Manutenção</span>
                <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-sm bg-[#9DB7DB]" />Combustível (NFs)</span>
              </span>
            }
          >
            {gastos.length === 0 ? (
              <Vazio>Ainda não há gastos registrados nos últimos 12 meses.</Vazio>
            ) : (
              <ul className="flex flex-col gap-3">
                {gastos.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="w-40 shrink-0 text-sm font-medium">{g.nome}</span>
                    <span className="flex h-[18px] min-w-[200px] flex-1 overflow-hidden rounded bg-slate-100" aria-hidden>
                      <span className="block bg-[#3F5A12]" style={{ width: `${(g.manutencao / maior) * 100}%` }} />
                      <span className="block bg-[#9DB7DB]" style={{ width: `${(g.combustivel / maior) * 100}%` }} />
                    </span>
                    <span className="text-[13px] tabular-nums text-slate-700">
                      Manut. {brl(g.manutencao)} · Comb. {brl(g.combustivel)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Cartao titulo="Alertas automáticos">
            {alertas.length === 0 ? (
              <Vazio>Nenhum alerta agora.</Vazio>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alertas.map((a) => (
                  <li key={a.codigo} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm">{a.texto}</span>
                      <SeloNivel nivel={a.nivel} comPonto={false}>{a.itens.length}</SeloNivel>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.itens.slice(0, 6).join(", ")}{a.itens.length > 6 ? `… e mais ${a.itens.length - 6}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">Os limites podem ser ajustados em Configurações.</p>
          </Cartao>

          <Cartao titulo="Como ler estes números">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13px] text-slate-700">
              <li>O valor do veículo é o da tabela FIPE do mês, pelo modelo e ano. Máquinas e veículos fora da tabela têm o valor informado pelo setor.</li>
              <li>Manutenção entra pela NF registrada ou, enquanto ela não chega, pelo valor da OC (ou do orçamento liberado). Orçamento recusado não conta.</li>
              <li>Combustível aparece por secretaria, porque a NF é da secretaria. Consumo por veículo depende dos dados do sistema de abastecimento.</li>
              <li>Veículos alugados ficam de fora da comparação com o valor: não são patrimônio da Prefeitura.</li>
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
