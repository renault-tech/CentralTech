"use client";

import * as React from "react";
import Link from "next/link";

import { CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import {
  CabecalhoPainel,
  CARTAO,
  GraficoMeses,
  Hero,
  LegendaSeries,
  LINK_TITULO,
  ListaAtencao,
  ListaBarras,
  ListaEtapas,
  Marca,
  Titulo,
  type LinhaBarraUi,
  type LinhaEtapaUi,
} from "@/components/modulo/painel-abertura-ui";
import type { PainelImoveis, Variacao } from "@/lib/imoveis/painel-abertura";
import { brlCompleto, brlCurto } from "@/lib/moeda";
import { cn } from "@/lib/utils";

const COR = { aluguel: "#0E7490", luz: "#D98E04", agua: "#2B7BC0" } as const;
const SERIES = [
  { nome: "Aluguel", cor: COR.aluguel },
  { nome: "Luz", cor: COR.luz },
  { nome: "Água", cor: COR.agua },
];

/** "9% acima da média" / "2% abaixo da média" / "sem histórico". */
function apoioVariacao(v: Variacao): string {
  if (!v) return "sem histórico para comparar";
  const pct = Math.round(Math.abs(v.fracao) * 100);
  return pct === 0 ? "na média dos 3 meses anteriores" : `${pct}% ${v.fracao > 0 ? "acima" : "abaixo"} da média`;
}

function HeroImoveis({ p }: { p: PainelImoveis }) {
  const t = p.totais;
  const i = p.imoveis;
  const luz = p.variacaoLuz;
  const altaLuz = !!luz && luz.fracao * 100 > p.limites.pctSecretaria;
  const total = p.variacaoTotal;
  return (
    <Hero
      tour="resumo-imoveis"
      rotulo="Gasto do mês"
      apoio={`${p.rotuloReferencia} · ${i.total} imóveis`}
      grande={brlCurto(t.total)}
      pequeno="aluguel, luz e água"
      sub={
        luz ? (
          <>
            A <b className="font-semibold text-white">luz</b> está <b className="font-semibold text-white">{Math.round(Math.abs(luz.fracao) * 100)}% {luz.fracao >= 0 ? "acima" : "abaixo"}</b> da média dos 3 meses anteriores.{" "}
            {p.foraDoPadraoTotal > 0 ? (
              <>
                <b className="font-semibold text-white">{p.foraDoPadraoTotal} {p.foraDoPadraoTotal === 1 ? "conta fugiu" : "contas fugiram"}</b> do padrão.
              </>
            ) : (
              "Nenhuma conta fora do padrão."
            )}
          </>
        ) : (
          <>Ainda não há meses suficientes de contas para comparar com a média.</>
        )
      }
      destaque={{ valor: total ? `${total.fracao >= 0 ? "+" : "−"}${Math.round(Math.abs(total.fracao) * 100)}%` : "—", rotulo: total ? "contra a média dos meses anteriores" : "sem histórico para comparar" }}
      rotuloBarra={`Aluguel ${brlCompleto(t.aluguel)}; luz ${brlCompleto(t.luz)}; água ${brlCompleto(t.agua)}`}
      segmentos={[
        { chave: "aluguel", valor: t.aluguel, cor: COR.aluguel, caixa: <CaixaTitulo rotulo="Aluguel" valor={brlCompleto(t.aluguel)} lado={String(i.alugados)} ladoApoio="imóveis alugados" /> },
        { chave: "luz", valor: t.luz, cor: COR.luz, caixa: <CaixaTitulo rotulo={`Luz · ${p.rotuloReferencia}`} valor={brlCompleto(t.luz)} lado={String(p.contasDoMes.find((c) => c.tipo === "luz")?.lancadas ?? 0)} ladoApoio="contas lançadas" /> },
        { chave: "agua", valor: t.agua, cor: COR.agua, caixa: <CaixaTitulo rotulo={`Água · ${p.rotuloReferencia}`} valor={brlCompleto(t.agua)} lado={String(p.contasDoMes.find((c) => c.tipo === "agua")?.lancadas ?? 0)} ladoApoio="contas lançadas" /> },
      ]}
      legenda={[
        { chave: "aluguel", nome: "Aluguel", valor: brlCurto(t.aluguel), apoio: `${i.alugados} ${i.alugados === 1 ? "imóvel alugado" : "imóveis alugados"}`, cor: COR.aluguel, href: "/imoveis/imoveis?vinc=alugado" },
        { chave: "luz", nome: "Luz", valor: brlCurto(t.luz), apoio: apoioVariacao(luz), cor: COR.luz, href: "/imoveis/luz", alerta: altaLuz },
        { chave: "agua", nome: "Água", valor: brlCurto(t.agua), apoio: apoioVariacao(p.variacaoAgua), cor: COR.agua, href: "/imoveis/agua", alerta: !!p.variacaoAgua && p.variacaoAgua.fracao * 100 > p.limites.pctSecretaria },
        { chave: "sem_lancamento", nome: "Sem lançamento", valor: String(p.semLancamento.unidades), apoio: `de ${p.semLancamento.total} unidades em ${p.rotuloReferencia}`, cor: "#F2B35E", href: "/imoveis/luz", alerta: p.semLancamento.unidades > 0 },
      ]}
      chips={[
        { nome: "Imóveis", quantidade: i.total, cor: "#5EC4D9", href: "/imoveis/imoveis" },
        { nome: "Alugados", quantidade: i.alugados, cor: "#AEBBD0", href: "/imoveis/imoveis?vinc=alugado" },
        { nome: "Próprios", quantidade: i.proprios, cor: "#AEBBD0", href: "/imoveis/imoveis?vinc=proprio" },
        { nome: "Cedidos", quantidade: i.cedidos, cor: "#AEBBD0", href: "/imoveis/imoveis?vinc=cedido" },
        ...(i.emEntrega > 0 ? [{ nome: "Em entrega", quantidade: i.emEntrega, cor: "#F2B35E", href: "/imoveis/entregas" }] : []),
        ...(i.revisar > 0 ? [{ nome: "Cadastro a revisar", quantidade: i.revisar, cor: "#F2B35E", href: "/imoveis/pendencias" }] : []),
      ]}
      insight={
        p.luzAlta.length > 0 ? (
          <>
            {p.luzAlta.length === 1 ? "Em 1 secretaria a" : `Em ${p.luzAlta.length} secretarias a`} <b className="text-white">luz</b> subiu mais de {Math.round(p.limites.pctSecretaria)}% sobre a média dos 3 meses anteriores:{" "}
            {p.luzAlta.map((s) => `${s.nome} (+${Math.round(s.fracao * 100)}%)`).join(", ")}.
          </>
        ) : null
      }
      rodape={
        <>
          <span>Dados até {p.rotuloReferencia}</span>
          {p.ultimoLancamento && <span>Último lançamento: {p.ultimoLancamento.split("-").reverse().join("/")}</span>}
          <span>Contas fora do padrão: acima de {p.limites.pctAcima}% da média</span>
        </>
      }
    />
  );
}

function CartaoContas({ p }: { p: PainelImoveis }) {
  const linhas: LinhaBarraUi[] = p.contasDoMes.map((c) => ({
    chave: c.tipo,
    titulo: c.tipo === "luz" ? "Luz" : "Água",
    sub: `${c.lancadas} de ${c.total} unidades`,
    href: c.tipo === "luz" ? "/imoveis/luz" : "/imoveis/agua",
    largura: c.total ? (c.lancadas / c.total) * 100 : 0,
    cor: c.tipo === "luz" ? COR.luz : COR.agua,
    direita: `${c.lancadas}/${c.total}`,
    caixa: <CaixaTitulo rotulo={`${c.tipo === "luz" ? "Luz" : "Água"} · ${p.rotuloReferencia}`} valor={`${c.lancadas} de ${c.total} lançadas`} lado={String(c.total - c.lancadas)} ladoApoio="faltam" />,
  }));
  const top = p.semLancamento.porSecretaria.slice(0, 4);
  const maior = Math.max(1, top[0]?.faltam ?? 1);
  const faltam: LinhaBarraUi[] = top.map((s) => ({
    chave: s.id,
    titulo: s.nome,
    href: `/imoveis/imoveis?sec=${s.id}`,
    largura: (s.faltam / maior) * 100,
    cor: "#F2B35E",
    direita: String(s.faltam),
    caixa: <CaixaTitulo rotulo="Sem a conta do mês" valor={s.nome} lado={String(s.faltam)} ladoApoio={s.faltam === 1 ? "unidade" : "unidades"} />,
  }));
  return (
    <section aria-label="Contas do mês" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 2 }}>
      <Titulo ver={{ href: "/imoveis/luz", rotulo: "Lançar" }}>Contas de {p.rotuloReferencia} lançadas</Titulo>
      <ListaBarras itens={linhas} grade="minmax(0,7rem) minmax(0,1fr) 3.75rem" />
      {faltam.length > 0 ? (
        <div className="mt-2 flex flex-1 flex-col border-t border-slate-200 pt-3">
          <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-600">Onde faltam mais contas</h3>
          <ListaBarras itens={faltam} grade="minmax(0,1fr) minmax(0,1.1fr) 2.25rem" />
          <p className="mt-2 text-[0.75rem] text-slate-600">
            {p.semLancamento.unidades} {p.semLancamento.unidades === 1 ? "unidade ainda sem" : "unidades ainda sem"} a conta de {p.rotuloReferencia}. A pendência aparece a partir do dia {p.limites.diaLancamento}.
          </p>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-3 text-[0.8125rem] font-medium text-emerald-700">Todas as contas de {p.rotuloReferencia} foram lançadas.</p>
      )}
    </section>
  );
}

function CartaoContratos({ p }: { p: PainelImoveis }) {
  const c = p.contratos;
  const itens: LinhaEtapaUi[] = [
    { chave: "vencidos", nome: "Vencidos", sub: "renovar ou entregar", quantidade: c.vencidos, cor: "#B91C1C", alerta: c.vencidos > 0, href: "/imoveis/vencimentos", unidade: c.vencidos === 1 ? "contrato" : "contratos" },
    { chave: "ate30", nome: "Vencem em 30 dias", quantidade: c.ate30, cor: "#D97706", alerta: c.ate30 > 0, href: "/imoveis/vencimentos", unidade: c.ate30 === 1 ? "contrato" : "contratos" },
    { chave: "limite", nome: `Vencem em ${c.limiteDias} dias`, sub: "aviso antecipado", quantidade: c.ateLimite, cor: "#E9A63B", href: "/imoveis/vencimentos", unidade: c.ateLimite === 1 ? "contrato" : "contratos" },
    { chave: "vigentes", nome: "Vigentes", sub: c.semFim ? `${c.semFim} sem data de fim` : undefined, quantidade: c.vigentes, cor: COR.aluguel, href: "/imoveis/imoveis?vinc=alugado", unidade: c.vigentes === 1 ? "contrato" : "contratos" },
  ];
  return (
    <section aria-label="Contratos e entregas" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 3 }}>
      <Titulo ver={{ href: "/imoveis/vencimentos", rotulo: "Vencimentos" }}>Contratos de aluguel</Titulo>
      <ListaEtapas itens={itens} numerada={false} />
      <div className="mt-2 flex flex-1 flex-col border-t border-slate-200 pt-3">
        <h3 className="flex items-center justify-between gap-3 text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-600">
          <span>Entregas em andamento</span>
          <Link href="/imoveis/entregas" className={cn(LINK_TITULO, "text-[0.8125rem]")}>
            Abrir
          </Link>
        </h3>
        {p.entregas.length === 0 ? (
          <p className="mt-3 flex flex-1 items-center text-[0.8125rem] text-slate-600">Nenhuma entrega em andamento.</p>
        ) : (
          <ul className="mt-2 flex flex-1 flex-col">
            {p.entregas.slice(0, 3).map((e) => (
              <li key={e.id} className="flex flex-1">
                <Link href={`/imoveis/imoveis/${e.id}`} className="flex w-full flex-col justify-center gap-1.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100">
                  <span className="flex items-baseline justify-between gap-3 text-[0.8125rem] text-cataguases-marinho">
                    <span className="min-w-0 truncate font-medium">
                      {e.nome} <span className="font-normal text-slate-600">· {e.secretaria}</span>
                    </span>
                    <span className={cn("flex-none text-[0.75rem] tabular-nums", e.alerta ? "font-semibold text-red-700" : "text-slate-600")}>
                      {e.feitas}/{e.total}
                    </span>
                  </span>
                  <span className="flex gap-1" aria-hidden>
                    {Array.from({ length: e.total }, (_, k) => (
                      <i key={k} className={cn("h-1.5 flex-1 rounded-full", k < e.feitas ? "bg-emerald-500" : k === e.feitas ? (e.alerta ? "bg-red-500" : "bg-[color:var(--modulo)]") : "bg-slate-200")} />
                    ))}
                  </span>
                  <span className={cn("truncate text-[0.75rem]", e.alerta ? "text-red-700" : "text-slate-600")}>{e.alerta ? "Atenção: " : "Próxima etapa: "}{e.proxima}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CartaoGasto({ p }: { p: PainelImoveis }) {
  const total12 = p.mensais.reduce((a, m) => a + m.aluguel + m.agua + m.luz, 0);
  const atual = p.mensais[p.mensais.length - 1]?.referencia;
  const rotulos = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return (
    <section aria-label="Gasto mensal" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 4 }}>
      <Titulo ver={{ href: "/imoveis/exportar?r=contas&formato=xlsx", rotulo: "Exportar" }}>Gasto mensal, últimos 12 meses</Titulo>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <LegendaSeries series={SERIES} />
        <span className="text-[0.78125rem] text-slate-600">
          12 meses: <b className="font-semibold tabular-nums text-cataguases-marinho">{brlCurto(total12)}</b>
        </span>
      </div>
      <GraficoMeses
        atual={atual}
        series={SERIES}
        meses={p.mensais.map((m) => {
          const mes = Number(m.referencia.slice(5, 7)) - 1;
          return { chave: m.referencia, rotulo: rotulos[mes], rotuloCompleto: `${rotulos[mes]}/${m.referencia.slice(2, 4)}`, valores: [m.aluguel, m.luz, m.agua] };
        })}
      />
      <p className="mt-2 text-[0.75rem] text-slate-600">O aluguel usa o valor atual dos contratos em todos os meses; luz e água são as contas lançadas.</p>
    </section>
  );
}

function CartaoSecretarias({ p }: { p: PainelImoveis }) {
  const top = p.porSecretaria.slice(0, 6);
  const resto = p.porSecretaria.slice(6);
  const linhas = resto.length
    ? [...top, { id: "demais", nome: "Demais", aluguel: resto.reduce((a, s) => a + s.aluguel, 0), luz: resto.reduce((a, s) => a + s.luz, 0), agua: resto.reduce((a, s) => a + s.agua, 0), total: resto.reduce((a, s) => a + s.total, 0) }]
    : top;
  const maior = Math.max(1, ...linhas.map((l) => l.total));
  const itens: LinhaBarraUi[] = linhas.map((s) => ({
    chave: s.id,
    titulo: s.nome,
    href: s.id === "demais" ? "/imoveis/imoveis" : `/imoveis/imoveis?sec=${s.id}`,
    largura: 0,
    cor: COR.aluguel,
    partes: [
      { largura: (s.aluguel / maior) * 100, cor: COR.aluguel },
      { largura: (s.luz / maior) * 100, cor: COR.luz },
      { largura: (s.agua / maior) * 100, cor: COR.agua },
    ],
    direita: brlCurto(s.total),
    caixa: (
      <>
        <CaixaTitulo rotulo={`Secretaria · ${p.rotuloReferencia}`} valor={s.nome} />
        <CaixaLinhas
          linhas={[
            { rotulo: "Aluguel", valor: brlCompleto(s.aluguel), cor: COR.aluguel },
            { rotulo: "Luz", valor: brlCompleto(s.luz), cor: COR.luz },
            { rotulo: "Água", valor: brlCompleto(s.agua), cor: COR.agua },
            { rotulo: "Total", valor: brlCompleto(s.total), forte: true },
          ]}
        />
      </>
    ),
  }));
  return (
    <section aria-label="Gasto por secretaria" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 5 }}>
      <Titulo ver={{ href: "/imoveis/configuracoes/secretarias", rotulo: "Ver todas" }}>Por secretaria · {p.rotuloReferencia}</Titulo>
      {itens.length === 0 ? <p className="flex flex-1 items-center justify-center py-8 text-sm text-slate-600">Sem dados no mês.</p> : <ListaBarras itens={itens} grade="minmax(0,1fr) minmax(0,1.3fr) 4.75rem" />}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-slate-600">
        {SERIES.map((s) => (
          <Marca key={s.nome} cor={s.cor}>
            {s.nome}
          </Marca>
        ))}
      </p>
    </section>
  );
}

function CartaoForaPadrao({ p }: { p: PainelImoveis }) {
  const maior = Math.max(1, ...p.foraDoPadrao.map((l) => Math.abs(l.variacao)));
  const itens: LinhaBarraUi[] = p.foraDoPadrao.map((l) => {
    const alta = l.variacao > p.limites.pctAcima;
    const cor = alta ? "#B91C1C" : "#D97706";
    const tipo = l.tipo === "luz" ? "Luz" : "Água";
    return {
      chave: l.chave,
      titulo: l.imovel,
      sub: `${tipo} · ${l.secretaria}`,
      href: `/imoveis/imoveis/${l.imovelId}`,
      largura: (Math.abs(l.variacao) / maior) * 100,
      cor,
      direita: `${l.variacao > 0 ? "+" : "−"}${Math.round(Math.abs(l.variacao))}%`,
      corDireita: cor,
      caixa: (
        <>
          <CaixaTitulo rotulo={`${tipo} · ${p.rotuloReferencia}`} valor={l.imovel} lado={`${l.variacao > 0 ? "+" : "−"}${Math.round(Math.abs(l.variacao))}%`} ladoApoio="sobre a média" corLado={cor} />
          <CaixaLinhas
            linhas={
              l.base === "valor"
                ? [
                    { rotulo: "Valor da conta", valor: brlCompleto(l.valor), forte: true },
                    { rotulo: "Média dos meses anteriores", valor: brlCompleto(l.media) },
                  ]
                : [
                    { rotulo: "Valor da conta", valor: brlCompleto(l.valor), forte: true },
                    { rotulo: "Consumo médio anterior", valor: `${Math.round(l.media)} ${l.unidade}` },
                  ]
            }
          />
          <CaixaNota>{l.secretaria}. Clique para abrir o imóvel.</CaixaNota>
        </>
      ),
    };
  });
  return (
    <section aria-label="Contas fora do padrão" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 6 }}>
      <Titulo ver={{ href: "/imoveis/pendencias", rotulo: p.foraDoPadraoTotal > itens.length ? `Ver as ${p.foraDoPadraoTotal}` : "Ver todas" }}>Contas fora do padrão</Titulo>
      {itens.length === 0 ? <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-600">Nenhuma conta fora do padrão. Bom sinal.</p> : <ListaBarras itens={itens} grade="minmax(0,1fr) minmax(0,1.1fr) 3.5rem" />}
      <p className="mt-2 text-[0.75rem] text-slate-600">Comparação da última conta de cada unidade com a média dos meses anteriores. Alerta a partir de {p.limites.pctAcima}% acima ou abaixo.</p>
    </section>
  );
}

function CartaoPrazos({ p }: { p: PainelImoveis }) {
  return (
    <section aria-label="Próximos prazos" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 7 }}>
      <Titulo ver={{ href: "/imoveis/vencimentos", rotulo: "Ver vencimentos" }}>O que vence nas próximas semanas</Titulo>
      {p.prazos.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-600">Nada vence nas próximas semanas.</p>
      ) : (
        <ul className="mt-2 flex flex-1 flex-col">
          {p.prazos.map((x) => {
            const tom = x.dias <= 7 ? "bg-red-50 text-red-700" : x.dias <= 21 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700";
            return (
              <li key={`${x.dias}-${x.titulo}`} className="flex flex-1 border-b border-slate-100 last:border-0">
                <Link href={x.href} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-slate-50">
                  <span className={cn("rounded-[0.625rem] px-2 py-1 text-center text-[0.78125rem] font-semibold tabular-nums", tom)}>{x.dias === 0 ? "hoje" : `${x.dias} ${x.dias === 1 ? "dia" : "dias"}`}</span>
                  <span className="min-w-0 text-[0.8125rem] text-cataguases-marinho">
                    <span className="block truncate">{x.titulo}</span>
                    <small className="block truncate text-[0.75rem] text-slate-600">{x.detalhe}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PainelAberturaImoveis({ painel: p, saudacao, dataExtenso, acao }: { painel: PainelImoveis; saudacao: string; dataExtenso: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <CabecalhoPainel saudacao={saudacao} apoio={dataExtenso} acao={acao} />
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HeroImoveis p={p} />
        <ListaAtencao itens={p.atencao} ver={{ href: "/imoveis/pendencias", rotulo: "Ver pendências" }} tour="atencao-imoveis" />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <CartaoContas p={p} />
        <CartaoContratos p={p} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CartaoGasto p={p} />
        <CartaoSecretarias p={p} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CartaoForaPadrao p={p} />
        <CartaoPrazos p={p} />
      </div>
    </div>
  );
}
