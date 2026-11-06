import Link from "next/link";

import { FormularioFiltros } from "@/components/modulo/formulario-filtros";

import { EtapasDocumentacao, FormularioOrcamento, PainelDecisao, type OpcaoVeiculo } from "@/components/frotas/formularios-manutencao";
import { Barra, Cartao, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem, Selo, SeloDias, TituloPagina, Vazio } from "@/components/frotas/ui";
import { analisarOrcamento } from "@/lib/frotas/analise";
import { listarFornecedores, listarManutencoes, listarNotas, listarSecretarias, listarVeiculos, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { filtrarManutencoes, lerFiltroManutencao } from "@/lib/frotas/filtros";
import {
  brl,
  diasEntre,
  formatarData,
  nivelPorDias,
  nivelPorPercentual,
  passosManutencao,
  pct,
  nfAcimaDaOc,
  situacaoManutencao,
  type EtapaManutencao,
} from "@/lib/frotas/regras";
import { montarUrl } from "@/lib/frotas/url";
import { dataNoFuso } from "@/lib/fuso";
import { cn } from "@/lib/utils";
import { MenuExportarFrotas } from "@/components/frotas/menu-exportar-frotas";
import { opcoesExportar } from "@/lib/frotas/exportacao";

export const metadata = { title: "Manutenção · Frotas" };

const TOM_ETAPA: Record<EtapaManutencao, "neutro" | "azul" | "verde" | "ambar" | "vermelho"> = {
  a_analisar: "azul",
  novo_orcamento: "ambar",
  recusada: "vermelho",
  liberada: "neutro",
  oc_emitida: "ambar",
  nf_registrada: "azul",
  concluida: "verde",
};

const FILTROS = [
  { chave: "andamento", rotulo: "Em andamento" },
  { chave: "a_analisar", rotulo: "A analisar" },
  { chave: "aguardando", rotulo: "Aguardando NF" },
  { chave: "concluidas", rotulo: "Concluídas" },
  { chave: "recusadas", rotulo: "Recusadas" },
  { chave: "todas", rotulo: "Todas" },
] as const;

export default async function PaginaManutencao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [veiculos, manutencoes, notas, secretarias, oficinas, params] = await Promise.all([
    listarVeiculos(),
    listarManutencoes(),
    listarNotas(),
    listarSecretarias(),
    listarFornecedores("oficina"),
    obterParametros(),
  ]);
  const hoje = dataNoFuso(new Date());
  const porVeiculo = new Map(veiculos.map((v) => [v.id, v]));
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const nomeOficina = new Map(oficinas.map((o) => [o.id, o.nome]));

  const filtro = lerFiltroManutencao(sp);
  const situacaoAtiva = filtro.situacao ?? "andamento";
  const lista = filtrarManutencoes(manutencoes, filtro, { veiculos: porVeiculo, secretarias: nomeSecretaria });

  const id = typeof sp.id === "string" ? sp.id : undefined;
  const atual = id ? (manutencoes.find((m) => m.id === id) ?? null) : null;
  const novo = gestor && sp.novo === "1";
  const base = { q: filtro.q, sit: filtro.situacao };

  const descreve = (veiculoId: string) => {
    const v = porVeiculo.get(veiculoId);
    return v ? `${v.placa ?? "Sem placa"} · ${v.modelo}${v.ano_modelo ? ` ${v.ano_modelo}` : ""}` : "Veículo removido";
  };

  const opcoesVeiculo: OpcaoVeiculo[] = veiculos
    .filter((v) => v.situacao !== "baixado")
    .map((v) => ({ id: v.id, rotulo: descreve(v.id), grupo: nomeSecretaria.get(v.secretaria_id) ?? "Sem secretaria" }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR") || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const servicosConhecidos = [...new Set(manutencoes.map((m) => m.servico))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const analise = atual ? analisarOrcamento(atual, { hoje, veiculos, manutencoes, notas, secretarias, params }) : null;
  const situacaoAtual = atual ? situacaoManutencao(atual) : null;
  const passos = atual ? passosManutencao(atual) : [];

  return (
    <>
      <TituloPagina
        titulo="Manutenção de veículos"
        subtitulo="Do orçamento da secretaria até a NF na Contabilidade. A OC é emitida no IPM; aqui só se registra o número."
        acao={
          <>
            <MenuExportarFrotas
              opcoes={opcoesExportar(
                [
                  { r: "manutencoes", rotulo: "Manutenções da lista", formatos: ["xlsx", "pdf", "csv"] },
                  { r: "contabilidade", rotulo: "Remessa à Contabilidade", formatos: ["pdf"] },
                ],
                base
              )}
            />
            {gestor && (
              <>
                <Link href="/frotas/manutencao/importar" className={CLASSE_BOTAO_SECUNDARIO}>
                  Importar PDFs
                </Link>
                <Link href={montarUrl("/frotas/manutencao", { ...base, novo: "1" })} className={CLASSE_BOTAO}>
                  Registrar orçamento
                </Link>
              </>
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2fr)]">
        <Cartao semPadding>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-3">
            {FILTROS.map((f) => (
              <Link
                key={f.chave}
                href={montarUrl("/frotas/manutencao", { sit: f.chave === "andamento" ? undefined : f.chave, q: filtro.q })}
                aria-current={situacaoAtiva === f.chave ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
                  situacaoAtiva === f.chave ? "bg-[#3F5A12] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                )}
              >
                {f.rotulo}
              </Link>
            ))}
          </div>
          <FormularioFiltros className="flex gap-2 border-b border-slate-100 p-3">
            {filtro.situacao && <input type="hidden" name="sit" value={filtro.situacao} />}
            <label htmlFor="m-busca" className="sr-only">
              Buscar OC, NF, placa ou serviço
            </label>
            <input
              id="m-busca"
              name="q"
              defaultValue={filtro.q}
              placeholder="OC, NF, placa ou serviço"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-cataguases-azul focus:ring-1 focus:ring-cataguases-azul"
            />
          </FormularioFiltros>
          {lista.length === 0 ? (
            <Vazio>Nenhuma manutenção encontrada.</Vazio>
          ) : (
            <ul>
              {lista.map((m) => {
                const s = situacaoManutencao(m);
                const dias = diasEntre(s.desde, hoje);
                const nivel = s.emAndamento ? nivelPorDias(dias, params) : "ok";
                const ativo = atual?.id === m.id;
                return (
                  <li key={m.id} className="border-b border-slate-100 last:border-0">
                    <Link
                      href={montarUrl("/frotas/manutencao", { ...base, id: m.id })}
                      className={cn(
                        "flex flex-col gap-1 border-l-4 px-4 py-3 hover:bg-slate-50",
                        ativo ? "bg-[#F4F8EA]" : "",
                        nivel === "critico" ? "border-l-red-600" : nivel === "atencao" ? "border-l-amber-500" : ativo ? "border-l-[#3F5A12]" : "border-l-transparent"
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-cataguases-marinho">{descreve(m.veiculo_id)}</span>
                        <span className="shrink-0 text-xs text-slate-500">{nomeSecretaria.get(m.secretaria_id)}</span>
                      </span>
                      <span className="text-[13px] text-slate-600">{m.servico}{m.oc_numero ? ` · OC ${m.oc_numero}` : ""}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Selo tom={TOM_ETAPA[s.etapa]}>{s.rotulo}</Selo>
                        {s.emAndamento && nivel !== "ok" && <SeloDias dias={dias} nivel={nivel} />}
                        {nfAcimaDaOc(m) !== null && <Selo tom="vermelho">NF acima da OC</Selo>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <div className="flex min-w-0 flex-col gap-6">
          {novo && (
            <Cartao titulo="Registrar orçamento">
              <FormularioOrcamento manutencao={null} veiculos={opcoesVeiculo} oficinas={oficinas} servicosConhecidos={servicosConhecidos} dataHoje={hoje} voltarPara={montarUrl("/frotas/manutencao", base)} />
            </Cartao>
          )}

          {!novo && !atual && (
            <Cartao>
              <Vazio>{id ? "Manutenção não encontrada." : "Escolha uma manutenção na lista para ver a análise e o andamento."}</Vazio>
            </Cartao>
          )}

          {atual && situacaoAtual && analise && (
            <>
              <Cartao>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-cataguases-marinho">{descreve(atual.veiculo_id)}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {nomeSecretaria.get(atual.secretaria_id)} · {atual.fornecedor_id ? (nomeOficina.get(atual.fornecedor_id) ?? "Oficina") : "Oficina não informada"} · orçamento recebido em {formatarData(atual.orcamento_recebido_em)}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Serviço: <strong className="font-semibold text-slate-800">{atual.servico}</strong>
                      {atual.descricao ? ` — ${atual.descricao}` : ""}
                    </p>
                  </div>
                  <Selo tom={TOM_ETAPA[situacaoAtual.etapa]}>{situacaoAtual.rotulo}</Selo>
                </div>
                <ol className="mt-5 grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
                  {passos.map((p, i) => (
                    <li key={p.chave} className="flex min-w-0 flex-col gap-1.5">
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                          p.estado === "feito" && "border-[#3F5A12] bg-[#3F5A12] text-white",
                          p.estado === "atual" && "border-[#3F5A12] bg-white text-[#3F5A12]",
                          p.estado === "futuro" && "border-slate-200 bg-slate-100 text-slate-500"
                        )}
                      >
                        {p.estado === "feito" ? "✓" : i + 1}
                      </span>
                      <span className={cn("text-xs leading-tight", p.estado === "atual" ? "font-bold text-cataguases-marinho" : "text-slate-700")}>
                        {p.nome}
                        <span className="sr-only">{p.estado === "feito" ? " (feito)" : p.estado === "atual" ? " (etapa atual)" : " (ainda não)"}</span>
                      </span>
                      <span className="text-xs text-slate-500">{p.data ? formatarData(p.data) : p.estado === "atual" ? "Etapa atual" : "—"}</span>
                    </li>
                  ))}
                </ol>
                {atual.analise_obs && (
                  <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <strong className="font-semibold">Análise ({formatarData(atual.analisado_em)}):</strong> {atual.analise_obs}
                  </p>
                )}
              </Cartao>

              <Cartao titulo="Análise do orçamento" apoio="Últimos 12 meses">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { r: "Orçamento", v: brl(atual.orcamento_valor), n: analise.pctEste !== null ? `${pct(analise.pctEste)} do valor do veículo` : atual.servico },
                    { r: "Valor de referência", v: brl(analise.valorReferencia), n: analise.valorReferencia ? (analise.fonteValor === "fipe" ? "Tabela FIPE" : "Informado pelo setor") : "Sem valor de referência" },
                    { r: "Gasto em 12 meses", v: brl(analise.gasto12m), n: `${analise.historico.length} ${analise.historico.length === 1 ? "serviço" : "serviços"}, sem contar este` },
                    { r: "Com este orçamento", v: brl(analise.gasto12m + atual.orcamento_valor), n: analise.pctComEste !== null ? `${pct(analise.pctComEste)} do valor` : "—" },
                  ].map((t) => (
                    <div key={t.r} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                      <span className="text-xs font-semibold text-slate-600">{t.r}</span>
                      <span className="mt-1 block text-xl font-bold tabular-nums tracking-tight text-cataguases-marinho">{t.v}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{t.n}</span>
                    </div>
                  ))}
                </div>

                {analise.pctComEste !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between gap-3 text-[13px] text-slate-600">
                      <span>Manutenção acumulada com este orçamento, em relação ao valor do veículo</span>
                      <strong className="font-semibold text-slate-900">{pct(analise.pctComEste)}</strong>
                    </div>
                    <Barra valor={analise.pctComEste} nivel={nivelPorPercentual(analise.pctComEste, params)} marcaEm={params.pct_atencao} />
                    <div className="mt-1 flex justify-between text-xs text-slate-500">
                      <span>0%</span>
                      <span>{params.pct_atencao}% · atenção</span>
                      <span>{params.pct_critico}% · vale mais que o veículo</span>
                    </div>
                  </div>
                )}

                {analise.acimaDaMediaPct !== null && analise.mediaParecidos !== null && (
                  <div className="mt-4">
                    <Mensagem tipo={analise.acimaDaMediaPct > params.orcamento_acima_pct ? "aviso" : "ok"}>
                      {analise.acimaDaMediaPct > 0 ? (
                        <>
                          <strong>{pct(analise.acimaDaMediaPct)} acima</strong>
                        </>
                      ) : (
                        <strong>{pct(Math.abs(analise.acimaDaMediaPct))} abaixo</strong>
                      )}{" "}
                      da média de serviços parecidos feitos na frota (média de {brl(analise.mediaParecidos)} em {analise.parecidos.length} serviços).
                    </Mensagem>
                  </div>
                )}
                {analise.valorReferencia === null && (
                  <p className="mt-4 text-sm text-slate-600">
                    Este veículo ainda não tem valor de referência: a comparação com o valor do veículo fica de fora até ser informado em{" "}
                    <Link href={`/frotas/veiculos?editar=${atual.veiculo_id}`} className="font-semibold text-[#3F5A12] underline">Veículos</Link>.
                  </p>
                )}

                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-cataguases-marinho">Histórico deste veículo</h3>
                    {analise.historico.length === 0 ? (
                      <p className="text-sm text-slate-500">Sem serviços liberados nos últimos 12 meses.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 text-[13px]">
                        {analise.historico.map((h) => (
                          <li key={h.id} className="flex justify-between gap-3 py-2">
                            <span>{formatarData(h.data)} · {h.servico}</span>
                            <span className="font-semibold tabular-nums">{brl(h.valor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-cataguases-marinho">Serviços parecidos na frota</h3>
                    {analise.parecidos.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum serviço de mesmo nome nos últimos 12 meses.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 text-[13px]">
                        {analise.parecidos.map((p) => (
                          <li key={p.id} className="flex justify-between gap-3 py-2">
                            <span>{p.servico} · {p.veiculo}</span>
                            <span className="font-semibold tabular-nums">{brl(p.valor)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Cartao>

              {gestor && atual.status_analise === "a_analisar" && (
                <Cartao titulo="Decisão do Setor de Frotas">
                  <PainelDecisao id={atual.id} />
                </Cartao>
              )}

              {atual.status_analise === "liberado" && (
                <Cartao titulo="Documentação" apoio={gestor ? undefined : "Somente leitura"}>
                  {gestor ? (
                    <EtapasDocumentacao manutencao={atual} dataHoje={hoje} />
                  ) : (
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {[
                        ["OC (IPM)", atual.oc_numero ?? "—"],
                        ["Valor da OC", brl(atual.oc_valor)],
                        ["NF da oficina", atual.nf_numero ? `${atual.nf_numero} · ${brl(atual.nf_valor)} · ${formatarData(atual.nf_emissao)}` : "—"],
                        ["Enviada à Contabilidade", formatarData(atual.enviada_contabilidade_em)],
                      ].map(([r, v]) => (
                        <div key={r}>
                          <dt className="text-xs font-semibold text-slate-600">{r}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Cartao>
              )}

              {gestor && (
                <details className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <summary className="cursor-pointer text-[15px] font-semibold text-cataguases-marinho">
                    {atual.status_analise === "a_analisar" || atual.status_analise === "novo_orcamento" ? "Corrigir o orçamento" : "Corrigir serviço, oficina ou observações"}
                  </summary>
                  <div className="mt-3">
                    <FormularioOrcamento
                      key={`${atual.id}-${atual.atualizado_em}`}
                      manutencao={atual}
                      veiculos={opcoesVeiculo}
                      oficinas={oficinas}
                      servicosConhecidos={servicosConhecidos}
                      dataHoje={hoje}
                      voltarPara={montarUrl("/frotas/manutencao", base)}
                    />
                    {atual.status_analise !== "liberado" && (
                      <p className="mt-3 text-xs text-slate-500">
                        {atual.status_analise === "novo_orcamento"
                          ? "Quando a secretaria mandar o novo orçamento, registre aqui o valor e a data: a análise reabre."
                          : "Orçamento recusado: o registro fica para consulta."}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
