"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, ClipboardList, FileText, Landmark, Receipt, XCircle } from "lucide-react";

import { CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import {
  Anel,
  CabecalhoPainel,
  CARTAO,
  Hero,
  LegendaSeries,
  LINK_TITULO,
  ListaAtencao,
  ListaBarras,
  ListaEtapas,
  ListaMovimentos,
  GraficoMeses,
  Marca,
  NotaAlerta,
  Titulo,
  type LinhaBarraUi,
  type LinhaEtapaUi,
  type MovimentoUi,
} from "@/components/modulo/painel-abertura-ui";
import type { LinhaEtapa, Movimento, PainelFrotas } from "@/lib/frotas/painel-abertura";
import { brlCompleto, brlCurto } from "@/lib/moeda";
import { cn } from "@/lib/utils";

const COR_VINCULO = { proprio: "#5C7A1F", convenio: "#0E7490", alugado: "#D98E04" } as const;
const SERIES_GASTO = [
  { nome: "Manutenção", cor: "#5C7A1F" },
  { nome: "Combustível (NFs)", cor: "#2B7BC0" },
];

const ICONE_MOV = { nf: FileText, oc: ClipboardList, liberado: CircleCheck, orcamento: Receipt, alerta: XCircle, contabilidade: Landmark } as const;
const COR_MOV = { nf: "#2563EB", oc: "#D97706", liberado: "#059669", orcamento: "#7C5CD6", alerta: "#B91C1C", contabilidade: "#0E7490" } as const;

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

function paraEtapas(l: LinhaEtapa[], unidade: string, pluralUnidade = unidade): LinhaEtapaUi[] {
  return l.map((e) => ({
    chave: e.chave,
    nome: e.nome,
    sub: e.sub,
    quantidade: e.quantidade,
    valor: e.valor !== null ? brlCompleto(e.valor) : undefined,
    cor: e.cor,
    alerta: e.alerta,
    nota: e.nota,
    href: e.href,
    unidade: e.quantidade === 1 ? unidade : pluralUnidade,
  }));
}

function textoQuinzena(p: PainelFrotas): React.ReactNode {
  const q = p.quinzena;
  if (q.esperadas === 0) return null;
  if (q.semNf.length === 0) return <>Quinzena anterior ({q.rotulo}): <b className="text-white">todas as {q.esperadas} secretarias</b> entregaram a NF de combustível.</>;
  const mostra = q.semNf.slice(0, 4).join(", ");
  const resto = q.semNf.length > 4 ? ` e mais ${q.semNf.length - 4}` : "";
  return (
    <>
      Quinzena anterior ({q.rotulo}): <b className="text-white">{q.recebidas} das {q.esperadas}</b> secretarias entregaram a NF de combustível. Faltam {mostra}
      {resto}.
    </>
  );
}

function HeroFrotas({ p }: { p: PainelFrotas }) {
  const a = p.emAberto;
  const v = p.veiculos;
  return (
    <Hero
      tour="resumo-frotas"
      rotulo="Em andamento na frota"
      apoio={`${v.total} veículos`}
      grande={brlCurto(a.valor)}
      pequeno="em manutenção aberta"
      sub={
        <>
          São <b className="font-semibold text-white">{a.manutencoes} {a.manutencoes === 1 ? "manutenção aberta" : "manutenções abertas"}</b> e{" "}
          <b className="font-semibold text-white">{a.nfs} {a.nfs === 1 ? "NF de combustível" : "NFs de combustível"}</b> ainda no caminho até a Contabilidade.
        </>
      }
      destaque={{ valor: a.tempoMedio !== null ? dias(a.tempoMedio) : "—", rotulo: "tempo médio parado na mesma etapa" }}
      rotuloBarra={p.segmentos.map((s) => `${s.nome}: ${brlCompleto(s.valor)}`).join("; ")}
      segmentos={p.segmentos.map((s) => ({
        chave: s.chave,
        valor: s.valor,
        cor: s.cor,
        caixa: <CaixaTitulo rotulo={s.nome} valor={brlCompleto(s.valor)} lado={String(s.quantidade)} ladoApoio={s.quantidade === 1 ? "manutenção" : "manutenções"} />,
      }))}
      legenda={p.cartoes.map((c) => ({ chave: c.chave, nome: c.nome, valor: String(c.quantidade), apoio: c.apoio, cor: c.cor, href: c.href, alerta: c.alerta }))}
      chips={[
        { nome: "Veículos", quantidade: v.total, cor: "#A9CB6A", href: "/frotas/veiculos" },
        { nome: "Próprios", quantidade: v.proprio, cor: "#AEBBD0", href: "/frotas/veiculos?vinc=proprio" },
        { nome: "De convênio", quantidade: v.convenio, cor: "#AEBBD0", href: "/frotas/veiculos?vinc=convenio" },
        { nome: "Alugados", quantidade: v.alugado, cor: "#AEBBD0", href: "/frotas/veiculos?vinc=alugado" },
        ...(v.revisar > 0 ? [{ nome: "Dados a revisar", quantidade: v.revisar, cor: "#F2B35E", href: "/frotas/veiculos?rev=1" }] : []),
      ]}
      insight={textoQuinzena(p)}
      rodape={
        <>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#F2B35E]" aria-hidden />Alerta amarelo: {dias(p.limites.diasAtencao)} parado na mesma etapa</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#F58A8A]" aria-hidden />Vermelho: {dias(p.limites.diasCritico)}</span>
          <span>Valor FIPE: atenção a partir de {p.limites.pctAtencao}%, crítico a partir de {p.limites.pctCritico}%</span>
        </>
      }
    />
  );
}

function CartaoManutencao({ p }: { p: PainelFrotas }) {
  const maisParada = p.manutEtapas.filter((e) => e.chave !== "concluida").sort((x, y) => y.quantidade - x.quantidade)[0];
  return (
    <section aria-label="Manutenção por etapa" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 2 }}>
      <Titulo ver={{ href: "/frotas/manutencao", rotulo: "Abrir" }}>Manutenção por etapa</Titulo>
      <ListaEtapas itens={paraEtapas(p.manutEtapas, "manutenção", "manutenções")} />
      {maisParada && maisParada.quantidade > 0 && (
        <NotaAlerta>
          <b className="font-semibold text-amber-700">Onde mais acumula:</b> {maisParada.quantidade} {maisParada.quantidade === 1 ? "manutenção está" : "manutenções estão"} em <b className="font-semibold text-cataguases-marinho">{maisParada.nome}</b>
          {maisParada.alerta ? ", e " + maisParada.nota : ""}.
        </NotaAlerta>
      )}
    </section>
  );
}

function CartaoCombustivel({ p }: { p: PainelFrotas }) {
  const q = p.quinzena;
  return (
    <section aria-label="Combustível" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 3 }}>
      <Titulo ver={{ href: "/frotas/combustivel", rotulo: "Abrir" }}>Combustível por etapa</Titulo>
      <ListaEtapas itens={paraEtapas(p.combEtapas, "NF", "NFs")} />
      <div data-tour="quinzena-frotas" className="mt-3 border-t border-slate-200 pt-3">
        <h3 className={cn("text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-600")}>Quinzena anterior · {q.rotulo}</h3>
        {q.esperadas === 0 ? (
          <p className="mt-2 text-[0.8125rem] text-slate-600">Nenhuma secretaria está marcada para controle de combustível. Ajuste em Configurações.</p>
        ) : (
          <div className="mt-2 flex items-center gap-3.5">
            <Anel fracao={q.recebidas / q.esperadas} cor="#5C7A1F" rotulo="entregaram" texto={`${q.recebidas}/${q.esperadas}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] text-slate-600">
                <b className="font-semibold text-cataguases-marinho">{q.recebidas} de {q.esperadas}</b> secretarias entregaram a NF
              </p>
              {q.semNf.length > 0 ? (
                <Link href={`/frotas/combustivel?quinz=${q.inicio}`} className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Ver as NFs da quinzena">
                  {q.semNf.map((nome) => (
                    <span key={nome} className="rounded-full bg-red-50 px-2.5 py-0.5 text-[0.75rem] font-medium text-red-700">
                      {nome}
                    </span>
                  ))}
                </Link>
              ) : (
                <p className="mt-1 text-[0.8125rem] font-medium text-emerald-700">Todas em dia.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CartaoFrota({ p }: { p: PainelFrotas }) {
  const v = p.veiculos;
  const total = Math.max(1, v.total);
  const r = 40;
  const c = 2 * Math.PI * r;
  let deslocamento = 0;
  const arcos = (["proprio", "convenio", "alugado"] as const).map((k) => {
    const comprimento = (v[k] / total) * c;
    const arco = { k, comprimento, deslocamento };
    deslocamento += comprimento;
    return arco;
  });
  const top = p.porSecretaria.slice(0, 5);
  const resto = p.porSecretaria.slice(5);
  const linhas: LinhaBarraUi[] = [
    ...top.map((s) => ({ id: s.id, nome: s.nome, quantidade: s.quantidade, href: `/frotas/veiculos?sec=${s.id}` })),
    ...(resto.length ? [{ id: "demais", nome: "Demais", quantidade: resto.reduce((a, s) => a + s.quantidade, 0), href: "/frotas/veiculos" }] : []),
  ].map((s) => ({
    chave: s.id,
    titulo: s.nome,
    href: s.href,
    largura: (s.quantidade / Math.max(1, top[0]?.quantidade ?? 1)) * 100,
    cor: "var(--modulo)",
    direita: String(s.quantidade),
    caixa: <CaixaTitulo rotulo="Secretaria" valor={s.nome} lado={String(s.quantidade)} ladoApoio={s.quantidade === 1 ? "veículo" : "veículos"} />,
  }));
  return (
    <section aria-label="A frota" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 4 }}>
      <Titulo ver={{ href: "/frotas/veiculos", rotulo: "Ver veículos" }}>A frota</Titulo>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-[5.75rem] w-[5.75rem] flex-none" role="img" aria-label={`${v.total} veículos: ${v.proprio} próprios, ${v.convenio} de convênio, ${v.alugado} alugados`}>
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-slate-200" />
          {arcos.map((a) => (
            <circle key={a.k} cx="50" cy="50" r={r} fill="none" stroke={COR_VINCULO[a.k]} strokeWidth="12" strokeDasharray={`${a.comprimento.toFixed(1)} ${(c - a.comprimento).toFixed(1)}`} strokeDashoffset={(-a.deslocamento).toFixed(1)} transform="rotate(-90 50 50)" className="emd-fatia" />
          ))}
          <text x="50" y="56" textAnchor="middle" fontSize="20" fontWeight="600" className="fill-current text-cataguases-marinho">
            {v.total}
          </text>
        </svg>
        <ul className="flex flex-col gap-1 text-[0.8125rem] text-slate-600">
          <li><Marca cor={COR_VINCULO.proprio}>Próprios <b className="ml-1 font-semibold tabular-nums text-cataguases-marinho">{v.proprio}</b></Marca></li>
          <li><Marca cor={COR_VINCULO.convenio}>De convênio <b className="ml-1 font-semibold tabular-nums text-cataguases-marinho">{v.convenio}</b></Marca></li>
          <li><Marca cor={COR_VINCULO.alugado}>Alugados <b className="ml-1 font-semibold tabular-nums text-cataguases-marinho">{v.alugado}</b></Marca></li>
        </ul>
      </div>
      <div className="mt-3 flex flex-1 flex-col border-t border-slate-200 pt-1">
        <ListaBarras itens={linhas} grade="minmax(0,1fr) minmax(0,1.1fr) 2.25rem" />
      </div>
    </section>
  );
}

function CartaoGasto({ p }: { p: PainelFrotas }) {
  const total12 = p.meses.reduce((a, m) => a + m.manutencao + m.combustivel, 0);
  const atual = p.meses[p.meses.length - 1]?.referencia;
  return (
    <section aria-label="Gasto por mês" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 5 }}>
      <Titulo ver={{ href: "/frotas/custos", rotulo: "Manutenção × FIPE" }}>Gasto por mês</Titulo>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <LegendaSeries series={SERIES_GASTO} />
        <span className="text-[0.78125rem] text-slate-600">
          12 meses: <b className="font-semibold tabular-nums text-cataguases-marinho">{brlCurto(total12)}</b>
        </span>
      </div>
      <GraficoMeses
        atual={atual}
        series={SERIES_GASTO}
        meses={p.meses.map((m) => ({ chave: m.referencia, rotulo: m.rotulo, rotuloCompleto: `${m.rotulo}/${m.referencia.slice(2, 4)}`, valores: [m.manutencao, m.combustivel] }))}
      />
      <p className="mt-2 text-[0.75rem] text-slate-600">O combustível entra pelo início da quinzena da NF; o mês corrente ainda pode receber NFs.</p>
    </section>
  );
}

function CartaoCustos({ p }: { p: PainelFrotas }) {
  const { pctAtencao, pctCritico } = p.limites;
  const escala = pctCritico * 1.4;
  const itens: LinhaBarraUi[] = p.custos.map((l) => {
    const cor = l.nivel === "critico" ? "#B91C1C" : l.nivel === "atencao" ? "#D97706" : "var(--modulo)";
    return {
      chave: l.id,
      titulo: `${l.placa} · ${l.modelo}`,
      sub: l.nivel === "critico" ? "acima do limite crítico" : l.nivel === "atencao" ? "perto do limite" : "dentro do esperado",
      href: `/frotas/analise`,
      largura: Math.min(100, (l.pct / escala) * 100),
      cor,
      marcas: [(pctAtencao / escala) * 100, (pctCritico / escala) * 100],
      direita: `${Math.round(l.pct)}%`,
      corDireita: l.nivel === "ok" ? undefined : cor,
      caixa: (
        <>
          <CaixaTitulo rotulo={`${l.placa} · ${l.modelo}`} valor={`${Math.round(l.pct)}% do valor`} />
          <CaixaLinhas
            linhas={[
              { rotulo: "Manutenção em 12 meses", valor: brlCompleto(l.custo12m), forte: true },
              { rotulo: "Valor de referência", valor: brlCompleto(l.valorFipe) },
            ]}
          />
          <CaixaNota>
            Atenção a partir de {pctAtencao}%, crítico a partir de {pctCritico}%.
          </CaixaNota>
        </>
      ),
    };
  });
  return (
    <section aria-label="Gasto de manutenção e valor do veículo" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 6 }}>
      <Titulo ver={{ href: "/frotas/custos", rotulo: "Ver todos" }}>Manutenção × valor do veículo</Titulo>
      {itens.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-slate-600">Nenhum veículo com manutenção nos últimos 12 meses.</p>
      ) : (
        <ListaBarras itens={itens} />
      )}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-slate-600">
        <Marca cor="var(--modulo)">Dentro do esperado</Marca>
        <Marca cor="#D97706">Atenção ({pctAtencao}%)</Marca>
        <Marca cor="#B91C1C">Crítico ({pctCritico}%)</Marca>
        <Link href="/frotas/analise" className={cn(LINK_TITULO, "ml-auto text-[0.75rem]")}>
          Análise da frota
        </Link>
      </p>
    </section>
  );
}

function CartaoMovimentos({ itens }: { itens: Movimento[] }) {
  const lista: MovimentoUi[] = itens.map((m, i) => {
    const Icone = ICONE_MOV[m.tipo];
    return { chave: `${m.data}-${i}`, icone: <Icone className="h-4 w-4" aria-hidden />, cor: COR_MOV[m.tipo], texto: m.texto, detalhe: m.detalhe, quando: m.quando, href: m.href };
  });
  return (
    <section aria-label="Últimos movimentos" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 7 }}>
      <Titulo ver={{ href: "/frotas/manutencao?sit=todas", rotulo: "Ver manutenções" }}>Últimos movimentos</Titulo>
      <ListaMovimentos itens={lista} vazio="Nenhum movimento registrado ainda." />
    </section>
  );
}

export function PainelAberturaFrotas({ painel: p, saudacao, dataExtenso, semVeiculos, gestor, acao }: { painel: PainelFrotas; saudacao: string; dataExtenso: string; semVeiculos: boolean; gestor: boolean; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <CabecalhoPainel saudacao={saudacao} apoio={dataExtenso} acao={acao} />
      {semVeiculos && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ainda não há veículos cadastrados.{" "}
          {gestor ? (
            <Link href="/frotas/veiculos/importar" className="font-semibold underline">
              Importe a planilha de veículos
            </Link>
          ) : (
            "O Setor de Frotas precisa importar a planilha de veículos."
          )}
        </div>
      )}
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HeroFrotas p={p} />
        <ListaAtencao itens={p.atencao} ver={{ href: "/frotas/analise", rotulo: "Ver análise" }} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-3">
        <CartaoManutencao p={p} />
        <CartaoCombustivel p={p} />
        <CartaoFrota p={p} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <CartaoGasto p={p} />
        <CartaoCustos p={p} />
      </div>
      <CartaoMovimentos itens={p.movimentos} />
    </div>
  );
}

