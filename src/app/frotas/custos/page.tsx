import Link from "next/link";

import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { AtualizarFipe } from "@/components/frotas/acoes-veiculos";
import { Barra, Cartao, CLASSE_BOTAO_SECUNDARIO, SeloNivel, TituloPagina, Vazio } from "@/components/frotas/ui";
import { custosFipe, filtrarCustos, periodoValido, ROTULO_PERIODO, type FiltroCustos, type PeriodoCusto } from "@/lib/frotas/custos";
import { listarManutencoes, listarSecretarias, listarVeiculos, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { diasEntre, formatarData, brl, pct } from "@/lib/frotas/regras";
import { dataNoFuso } from "@/lib/fuso";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

export const maxDuration = 60;
export const metadata = { title: "Manutenção × FIPE · Frotas" };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const ROTULO_NIVEL = { ok: "Dentro do esperado", atencao: "Atenção", critico: "Avaliar baixa ou troca" } as const;
/** Valor mais velho que isto merece atualização (a FIPE muda todo mês). */
const DIAS_VALOR_VELHO = 45;

export default async function PaginaCustos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const periodo: PeriodoCusto = periodoValido(um(sp.p));
  const nivelBruto = um(sp.nivel);
  const filtro: FiltroCustos = {
    q: um(sp.q),
    secretaria: um(sp.sec),
    nivel: nivelBruto === "ok" || nivelBruto === "atencao" || nivelBruto === "critico" || nivelBruto === "sem_valor" ? nivelBruto : undefined,
  };

  const [veiculos, manutencoes, secretarias, params, ctx] = await Promise.all([
    listarVeiculos(),
    listarManutencoes(),
    listarSecretarias(),
    obterParametros(),
    obterContextoFrotas(),
  ]);
  const hoje = dataNoFuso(new Date());
  const { linhas, resumo } = custosFipe({ hoje, veiculos, manutencoes, params, periodo });
  const visiveis = filtrarCustos(linhas, filtro);
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const vinculadosFipe = veiculos.filter((v) => v.valor_fonte === "fipe").length;

  const kpis = [
    { r: `Manutenção · ${ROTULO_PERIODO[periodo].toLowerCase()}`, v: brl(resumo.gastoPeriodo), n: `${resumo.veiculosComGasto} veículos com serviço` },
    { r: "Valor da frota na FIPE", v: brl(resumo.valorFrota), n: "Só os veículos com gasto e valor" },
    { r: "Gasto sobre o valor", v: resumo.pctFrota === null ? "—" : `${resumo.pctFrota.toFixed(1).replace(".", ",")}%`, n: "Manutenção ÷ valor FIPE" },
    { r: `Acima de ${params.pct_atencao}% do valor`, v: String(resumo.atencao + resumo.critico), n: `${resumo.critico} acima de ${params.pct_critico}%` },
    { r: "Sem valor na FIPE", v: String(resumo.semValor), n: resumo.semValor ? `${brl(resumo.gastoSemValor)} sem comparação` : "Tudo comparável" },
  ];

  return (
    <>
      <TituloPagina
        titulo="Manutenção × valor na FIPE"
        acao={ctx.situacao === "ok" && ctx.gestor ? <AtualizarFipe /> : undefined}
      />

      <section aria-label="Indicadores" className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.r} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-xs font-medium text-slate-600">{k.r}</span>
            <span className="mt-1 block truncate text-2xl font-bold tabular-nums tracking-tight text-cataguases-marinho">{k.v}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{k.n}</span>
          </div>
        ))}
      </section>

      {vinculadosFipe === 0 && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          Nenhum veículo está ligado à tabela FIPE ainda. Em{" "}
          <Link href="/frotas/veiculos" className="font-semibold underline">Veículos</Link>, abra um veículo → &quot;Procurar na FIPE&quot; para ligar; depois use &quot;Atualizar valores da FIPE&quot; todo mês.
        </p>
      )}

      <Cartao
        titulo="Veículo por veículo"
        apoio={`Atenção a partir de ${params.pct_atencao}% do valor no período, avaliar baixa ou troca a partir de ${params.pct_critico}%`}
        semPadding
      >
        <FormularioFiltros className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5" limpar={{ href: "/frotas/custos", className: CLASSE_BOTAO_SECUNDARIO }}>
          <div className="flex min-w-[200px] flex-[2] flex-col gap-1">
            <label htmlFor="c-q" className="text-xs font-semibold text-slate-600">Buscar</label>
            <input id="c-q" name="q" defaultValue={filtro.q} placeholder="Placa, modelo, marca ou patrimônio" className={ESTILO_CAMPO_PADRAO} />
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <label htmlFor="c-p" className="text-xs font-semibold text-slate-600">Período</label>
            <select id="c-p" name="p" defaultValue={periodo} className={ESTILO_CAMPO_PADRAO}>
              {(Object.keys(ROTULO_PERIODO) as PeriodoCusto[]).map((k) => (
                <option key={k} value={k}>{ROTULO_PERIODO[k]}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <label htmlFor="c-s" className="text-xs font-semibold text-slate-600">Secretaria</label>
            <select id="c-s" name="sec" defaultValue={filtro.secretaria ?? ""} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <label htmlFor="c-n" className="text-xs font-semibold text-slate-600">Situação do gasto</label>
            <select id="c-n" name="nivel" defaultValue={filtro.nivel ?? ""} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              <option value="critico">Avaliar baixa ou troca</option>
              <option value="atencao">Atenção</option>
              <option value="ok">Dentro do esperado</option>
              <option value="sem_valor">Sem valor na FIPE</option>
            </select>
          </div>
        </FormularioFiltros>

        {visiveis.length === 0 ? (
          <Vazio>{linhas.length === 0 ? "Ainda não há manutenção liberada." : "Nenhum veículo encontrado com esses filtros."}</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  {["Veículo", "Secretaria", "Valor na FIPE", `Manutenção (${ROTULO_PERIODO[periodo].toLowerCase()})`, "% do valor", "Acumulado", "Situação"].map((t) => (
                    <th key={t} scope="col" className="px-4 py-2.5 first:sm:pl-5">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const velho = l.valor !== null && l.veiculo.valor_referencia_em !== null && diasEntre(l.veiculo.valor_referencia_em, hoje) > DIAS_VALOR_VELHO;
                  return (
                    <tr key={l.veiculo.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                      <td className="px-4 py-2.5 sm:pl-5">
                        <Link href={`/frotas/veiculos?editar=${l.veiculo.id}`} className="font-semibold text-cataguases-marinho hover:underline">
                          {l.veiculo.placa ?? "Sem placa"}
                        </Link>
                        <span className="block text-xs text-slate-500">{l.veiculo.modelo} {l.veiculo.ano_modelo ?? ""}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {l.porAno.map((a) => `${a.ano}: ${brl(a.valor)}`).join(" · ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{nomeSecretaria.get(l.veiculo.secretaria_id) ?? "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {l.valor === null ? (
                          <span className="text-slate-500">{l.veiculo.vinculo === "alugado" ? "Alugado" : "Sem valor"}</span>
                        ) : (
                          <>
                            {brl(l.valor)}
                            <span className={`block text-xs ${velho ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                              {l.veiculo.valor_fonte === "manual" ? "digitado" : l.veiculo.fipe_referencia ?? "FIPE"}
                              {l.veiculo.valor_referencia_em ? ` · em ${formatarData(l.veiculo.valor_referencia_em)}` : ""}
                              {velho ? " · desatualizado" : ""}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{brl(l.custoPeriodo)}</td>
                      <td className="px-4 py-2.5">
                        {l.pctPeriodo === null ? (
                          "—"
                        ) : (
                          <span className="flex min-w-[130px] items-center gap-2">
                            <span className="flex-1"><Barra valor={l.pctPeriodo} nivel={l.nivel} marcaEm={params.pct_atencao} /></span>
                            <span className="w-11 text-right font-semibold tabular-nums">{pct(l.pctPeriodo)}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {brl(l.custoTotal)}
                        <span className="block text-xs text-slate-500">
                          {l.pctTotal !== null ? `${pct(l.pctTotal)} do valor · ` : ""}
                          {l.servicos} {l.servicos === 1 ? "serviço" : "serviços"}
                          {l.ultimaData ? ` · último em ${formatarData(l.ultimaData)}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {l.valor === null ? <span className="text-xs text-slate-500">Sem comparação</span> : <SeloNivel nivel={l.nivel}>{ROTULO_NIVEL[l.nivel]}</SeloNivel>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  );
}
