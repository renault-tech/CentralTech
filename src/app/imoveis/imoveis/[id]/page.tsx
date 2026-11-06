import Link from "next/link";
import { notFound } from "next/navigation";

import { EtapasEntrega } from "@/components/imoveis/etapas-entrega";
import { FormularioConta, type OpcaoUnidade } from "@/components/imoveis/formulario-conta";
import { FormularioEntrega } from "@/components/imoveis/formulario-entrega";
import { FormularioImovel } from "@/components/imoveis/formulario-imovel";
import { FormularioUnidade } from "@/components/imoveis/formulario-unidade";
import { GraficoColunas } from "@/components/imoveis/graficos";
import { Cartao, SeloGravidade, SeloSituacaoImovel, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { listarAuditoria, obterContextoImoveis } from "@/lib/imoveis/dados";
import { analisarConsumo, brl, formatarData, mascararDocumento, referenciaDe, rotuloMes, ROTULO_TIPO, situacaoVigencia, UNIDADE_DE_MEDIDA, ultimosMeses } from "@/lib/imoveis/regras";
import { cn } from "@/lib/utils";

export const metadata = { title: "Imóvel · Imóveis e Consumo" };

const ABAS = [
  ["contrato", "Contrato"],
  ["contas", "Contas de água e luz"],
  ["entrega", "Entrega"],
  ["historico", "Histórico"],
] as const;

export default async function DetalheImovel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; editar?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const aba = ABAS.some(([k]) => k === sp.aba) ? (sp.aba as (typeof ABAS)[number][0]) : "contrato";
  const ctx = await obterContextoImoveis();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const t = await carregarTudo();
  const imovel = t.imoveis.find((i) => i.id === id);
  if (!imovel) notFound();

  const sec = t.secretarias.find((s) => s.id === imovel.secretaria_id);
  const imob = t.imobiliarias.find((m) => m.id === imovel.imobiliaria_id);
  const unidades = t.unidades.filter((u) => u.imovel_id === id);
  const entrega = t.entregas.find((e) => e.id === id) ?? null;
  const pend = t.pendencias.filter((p) => p.imovelId === id);
  const vig = situacaoVigencia(imovel.vigencia_fim, t.hoje, t.par);
  const mesAtual = referenciaDe(t.hoje);
  const refDados = t.contas.map((c) => c.referencia).filter((r) => r <= mesAtual).sort().at(-1) ?? mesAtual;
  const meses = ultimosMeses(refDados, 12);
  const base = `/imoveis/imoveis/${id}`;
  const auditoria = aba === "historico" && gestor ? await listarAuditoria("imoveis", id).catch(() => []) : [];

  const opcoes: OpcaoUnidade[] = unidades.map((u) => ({
    id: u.id,
    tipo: u.tipo,
    rotulo: `${ROTULO_TIPO[u.tipo]} · ${u.numero}`,
    historico: t.contas.filter((c) => c.unidade_id === u.id).map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor })),
  }));

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/imoveis/imoveis" className="font-medium text-[color:var(--modulo-tinta)] hover:underline">← Imóveis</Link></p>
      <TituloPagina
        titulo={imovel.nome}
        subtitulo={`${imovel.endereco} · ${sec?.nome ?? "—"}${imovel.setor ? ` · ${imovel.setor}` : ""}`}
        acao={<SeloSituacaoImovel situacao={imovel.situacao} />}
      />

      {pend.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {pend.map((p) => (
            <div key={p.chave} className={cn("flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm", p.nivel === "critico" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900")}>
              <SeloGravidade nivel={p.nivel} />
              <span><b>{p.titulo}.</b> {p.detalhe}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Aluguel mensal", brl(imovel.valor_aluguel)],
          ["Contrato", imovel.vigencia_fim ? `até ${formatarData(imovel.vigencia_fim)}` : "—"],
          ["Vencimento do contrato", imovel.situacao === "entregue" ? "Entregue" : vig.texto],
          ["Reajuste", imovel.proximo_reajuste ? `${imovel.indice_reajuste ?? ""} em ${formatarData(imovel.proximo_reajuste)}` : imovel.indice_reajuste ?? "—"],
        ].map(([r, vlr]) => (
          <div key={r} className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-xs font-medium text-slate-600">{r}</p>
            <p className="mt-0.5 text-lg font-semibold text-cataguases-marinho tabular-nums">{vlr}</p>
          </div>
        ))}
      </div>

      <nav className="mb-4 flex flex-wrap gap-x-1 border-b border-slate-200" aria-label="Seções do imóvel">
        {ABAS.map(([k, r]) => (
          <Link key={k} href={`${base}?aba=${k}`} aria-current={aba === k ? "page" : undefined} className={cn("border-b-2 px-3 py-2.5 text-sm", aba === k ? "border-[color:var(--modulo)] font-semibold text-[color:var(--modulo-tinta)]" : "border-transparent text-slate-600 hover:text-cataguases-marinho")}>
            {r}
          </Link>
        ))}
      </nav>

      {aba === "contrato" &&
        (gestor && sp.editar === "1" ? (
          <Cartao titulo="Editar imóvel">
            <FormularioImovel imovel={imovel} secretarias={t.secretarias} imobiliarias={t.imobiliarias} voltarPara={base} />
          </Cartao>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao titulo="Contrato" acao={gestor ? <Link href={`${base}?aba=contrato&editar=1`} className="text-sm font-medium text-[color:var(--modulo-tinta)] hover:underline">Editar</Link> : undefined}>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ["Número", imovel.contrato_numero ?? "—"],
                  ["Vigência", `${formatarData(imovel.vigencia_inicio)} a ${formatarData(imovel.vigencia_fim)}`],
                  ["Aluguel mensal", brl(imovel.valor_aluguel)],
                  ["Vencimento do aluguel", imovel.dia_vencimento ? `todo dia ${imovel.dia_vencimento}` : "—"],
                  ["Índice de reajuste", imovel.indice_reajuste ?? "—"],
                  ["Finalidade", imovel.finalidade ?? "—"],
                ].map(([r, vlr]) => (
                  <div key={r}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r}</dt><dd className="mt-0.5 text-sm font-medium">{vlr}</dd></div>
                ))}
              </dl>
            </Cartao>
            <Cartao titulo="Imobiliária e proprietário">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ["Imobiliária", imob?.nome ?? "Direto com o proprietário"],
                  ["Proprietário", imovel.proprietario_nome ?? "—"],
                  ["CPF / CNPJ", mascararDocumento(imovel.proprietario_documento)],
                  ["Contato", imovel.proprietario_contato ?? imob?.telefone ?? "—"],
                  ["Conta para pagamento", imovel.proprietario_conta ?? "—"],
                ].map(([r, vlr]) => (
                  <div key={r}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{r}</dt><dd className="mt-0.5 break-words text-sm font-medium">{vlr}</dd></div>
                ))}
              </dl>
              {imovel.observacoes && <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">{imovel.observacoes}</p>}
            </Cartao>
          </div>
        ))}

      {aba === "contas" && (
        <div className="flex flex-col gap-4">
          {unidades.length === 0 && <Cartao><Vazio>Nenhuma matrícula de água ou UC de energia cadastrada neste imóvel.</Vazio></Cartao>}
          {unidades.map((u) => {
            const cs = t.contas.filter((c) => c.unidade_id === u.id);
            const porMes = new Map(cs.map((c) => [c.referencia, c]));
            const valores = meses.map((m) => porMes.get(m)?.consumo ?? 0);
            const historico = cs.map((c) => ({ referencia: c.referencia, consumo: c.consumo, valor: c.valor }));
            const anom = analisarConsumo(historico.filter((p) => p.referencia <= mesAtual), t.par, UNIDADE_DE_MEDIDA[u.tipo]);
            const med = (() => {
              const prev = [...cs].sort((a, b) => a.referencia.localeCompare(b.referencia)).slice(0, -1).filter((c) => (c.consumo ?? 0) > 0).slice(-t.par.meses_media);
              return prev.length >= 3 ? prev.reduce((a, c) => a + (c.consumo ?? 0), 0) / prev.length : null;
            })();
            return (
              <Cartao key={u.id} titulo={`${ROTULO_TIPO[u.tipo]} · ${u.numero}`} apoio={`Titular: ${u.titular ?? "—"}${u.ativa ? "" : " · desligada"}`} acao={anom.length ? <SeloGravidade nivel={anom[0].nivel === "critico" ? "critico" : "atencao"} /> : undefined}>
                {anom.map((a) => <p key={a.tipo} className="mb-2 text-sm text-slate-700">{rotuloMes(historico.sort((x, y) => x.referencia.localeCompare(y.referencia)).at(-1)!.referencia)}: {a.texto}.</p>)}
                {cs.length === 0 ? <Vazio>Nenhuma conta lançada.</Vazio> : (
                  <>
                    <GraficoColunas rotulos={meses.map((m) => rotuloMes(m).slice(0, 3))} valores={valores} cor={u.tipo === "agua" ? "#2B7BC0" : "#D98E04"} media={med} alerta={anom.some((a) => a.tipo === "acima")} />
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="text-xs font-semibold text-slate-600"><tr><th className="py-1.5 pr-3">Mês</th><th className="py-1.5 pr-3">Consumo</th><th className="py-1.5 pr-3">Valor</th><th className="py-1.5 pr-3">Vencimento</th><th className="py-1.5">Pago em</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {cs.slice(0, 6).map((c) => (
                            <tr key={c.id}><td className="py-1.5 pr-3">{rotuloMes(c.referencia)}</td><td className="py-1.5 pr-3 tabular-nums">{c.consumo ?? "—"} {c.consumo != null ? UNIDADE_DE_MEDIDA[u.tipo] : ""}</td><td className="py-1.5 pr-3 tabular-nums">{brl(c.valor)}</td><td className="py-1.5 pr-3 tabular-nums">{formatarData(c.vencimento)}</td><td className="py-1.5 tabular-nums">{c.pago_em ? formatarData(c.pago_em) : "em aberto"}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Cartao>
            );
          })}
          {gestor && unidades.length > 0 && (
            <Cartao titulo="Lançar conta"><FormularioConta conta={null} unidades={opcoes} par={t.par} mesPadrao={refDados} /></Cartao>
          )}
          {gestor && (
            <Cartao titulo="Adicionar matrícula ou unidade consumidora"><FormularioUnidade imovelId={id} /></Cartao>
          )}
        </div>
      )}

      {aba === "entrega" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo="Etapas da entrega" apoio={entrega ? undefined : "Nenhuma entrega aberta"}>
            <EtapasEntrega entrega={entrega} />
            {!entrega && !gestor && <Vazio>Quando a secretaria avisar a saída, o Setor de Imóveis abre as etapas aqui.</Vazio>}
          </Cartao>
          {gestor && (
            <Cartao titulo={entrega ? "Registrar etapas" : "Iniciar a entrega"}>
              <FormularioEntrega imovelId={id} entrega={entrega} />
            </Cartao>
          )}
        </div>
      )}

      {aba === "historico" && (
        <Cartao titulo="Histórico de alterações">
          {!gestor ? <Vazio>O histórico completo fica disponível ao Setor de Imóveis.</Vazio> : auditoria.length === 0 ? <Vazio>Sem alterações registradas.</Vazio> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {auditoria.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.acao === "INSERT" ? "Cadastro" : a.acao === "UPDATE" ? "Alteração" : "Exclusão"}</span><span className="text-slate-500 tabular-nums">{new Date(a.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></li>)}
            </ul>
          )}
        </Cartao>
      )}
    </>
  );
}
