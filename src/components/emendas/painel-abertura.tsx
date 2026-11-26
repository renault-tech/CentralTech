"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, ChevronRight, Coins, FileCheck2, Undo2 } from "lucide-react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { COR_DINHEIRO } from "@/lib/emendas/cores-financeiras";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import type { ItemAtencao, Painel } from "@/lib/emendas/painel-abertura";
import { brl, brlCurto, pct } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";

const CARTAO = "emd-entra rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const ROTULO = "text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-slate-600";
const LINK_TITULO = "text-[0.8125rem] font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] underline-offset-2 hover:underline";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COR_GRAVIDADE = { alta: "#B91C1C", media: "#D97706", info: "#2563EB" } as const;
const COR_FUNIL = ["#8B73D6", "#6B4FBB", "#2563EB", "#0E7490", "#059669", "#4D7C0F"];

function Titulo({ children, ver }: { children: React.ReactNode; ver?: { href: string; rotulo: string } }) {
  return (
    <h2 className={cn(ROTULO, "flex items-center justify-between gap-3")}>
      <span>{children}</span>
      {ver && (
        <Link href={ver.href} className={LINK_TITULO}>
          {ver.rotulo}
        </Link>
      )}
    </h2>
  );
}

/** Anel de percentual (SVG): usa a classe de enchimento `emd-fatia` do módulo. */
function Anel({ fracao, cor, rotulo }: { fracao: number; cor: string; rotulo: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg viewBox="0 0 92 92" className="h-[5.75rem] w-[5.75rem] flex-none" role="img" aria-label={`${pct(f, 0)} ${rotulo}`}>
      <circle cx="46" cy="46" r={r} fill="none" strokeWidth="9" className="stroke-slate-200" />
      <circle cx="46" cy="46" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 46 46)" className="emd-fatia" />
      <text x="46" y="46" textAnchor="middle" fontSize="19" fontWeight="600" className="fill-current text-cataguases-marinho">
        {Math.round(f * 100)}%
      </text>
      <text x="46" y="60" textAnchor="middle" fontSize="8.5" className="fill-slate-500">
        {rotulo}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Faixa de cima: execução do exercício + o que pede atenção
// ---------------------------------------------------------------------------------------------------------------------

function Hero({ p, ano, diasFim }: { p: Painel; ano: number; diasFim: number }) {
  const base = Math.max(p.total, p.pago + p.aPagar + p.semEmpenhar) || 1;
  const partes = [
    { nome: "Pago", valor: p.pago, cor: COR_DINHEIRO.pago },
    { nome: "Empenhado, a pagar", valor: p.aPagar, cor: COR_DINHEIRO.empenhado },
    { nome: "Sem empenhar", valor: p.semEmpenhar, cor: COR_DINHEIRO.semEmpenhar },
  ];
  const m = p.meta;
  const ok = m.atingida;
  const VERDE = { fundo: "rgba(52,211,153,.16)", borda: "rgba(110,231,183,.45)", texto: "#A7F3D0" };
  const VERMELHO = { fundo: "rgba(248,113,113,.18)", borda: "rgba(252,165,165,.5)", texto: "#FECACA" };
  type Tom = typeof VERDE;
  const legenda: { nome: string; valor: number; cor: string; apoio: string; href: string; tom?: Tom }[] = [
    { nome: "Aprovado (indicado)", valor: p.total, cor: COR_DINHEIRO.indicado, apoio: `${p.quantidade} emendas`, href: `/emendas/lista?ano=${ano}` },
    { nome: "Pago", valor: p.pago, cor: COR_DINHEIRO.pago, apoio: `${pct(m.fracaoPago, 1)} do aprovado`, href: `/emendas/lista?fin=paga&ano=${ano}`, tom: VERDE },
    { nome: "Em restos a pagar", valor: m.restosAPagar, cor: "#34D399", apoio: "empenhado, não pago: dentro da lei", href: `/emendas/lista?fin=empenhada_sem_pagamento&ano=${ano}`, tom: VERDE },
    { nome: "Falta empenhar p/ a lei", valor: m.semEmpenho, cor: ok ? "#34D399" : "#F87171", apoio: ok ? "nada a empenhar: meta atingida" : "ainda fora da lei", href: `/emendas/lista?fin=sem_empenho&ano=${ano}`, tom: ok ? VERDE : VERMELHO },
    { nome: "Falta pagar (total)", valor: m.faltaPagar, cor: m.faltaPagar > 0 ? "#F87171" : "#34D399", apoio: "restos a pagar + sem empenho", href: `/emendas/lista?ano=${ano}`, tom: m.faltaPagar > 0 ? VERMELHO : VERDE },
  ];
  const chips: { nome: string; quantidade: number; cor: string; href: string }[] = [
    { nome: "Pagas", quantidade: p.situacoes[0].quantidade, cor: "#34D399", href: `/emendas/lista?fin=paga&ano=${ano}` },
    { nome: "Pagas em parte", quantidade: p.situacoes[1].quantidade, cor: "#FBBF24", href: `/emendas/lista?fin=paga_parcial&ano=${ano}` },
    { nome: "Empenhadas, sem pagamento", quantidade: p.situacoes[2].quantidade, cor: "#8DB3FF", href: `/emendas/lista?fin=empenhada_sem_pagamento&ano=${ano}` },
    { nome: "Sem empenho", quantidade: p.situacoes[3].quantidade, cor: "#AEBBD0", href: `/emendas/lista?fin=sem_empenho&ano=${ano}` },
    { nome: "Com pendência", quantidade: p.comPendencia, cor: "#F2B35E", href: `/emendas/pendencias?ano=${ano}` },
    { nome: "Impedidas", quantidade: p.impedidas, cor: "#F58A8A", href: `/emendas/lista?situacao=impedida&ano=${ano}` },
  ];
  const c = p.curva;
  const insight =
    c.necessarioSemanal !== null && p.pago < p.total
      ? `Faltam ${diasFim} dias. Para pagar tudo até 31/12 seria preciso pagar ${brlCurto(c.necessarioSemanal)} por semana; nas últimas 8 semanas a média foi ${brlCurto(c.mediaSemanal)}.`
      : null;

  // Régua do exercício: hoje entre o início do ano e 31/12.
  const fracaoAno = Math.min(1, Math.max(0, (diasFim >= 0 ? 365 - diasFim : 365) / 365));

  return (
    <section aria-label="Execução do exercício" data-tour="indicadores-emendas" className="emd-entra relative flex flex-col overflow-hidden rounded-2xl p-5 text-[#EAF0F9] sm:p-6" style={{ background: "radial-gradient(120% 140% at 100% 0%, rgba(107,79,187,.55), transparent 55%), linear-gradient(135deg, #0C1D33, #12294A)", ["--i" as string]: 0 }}>
      <h2 className="flex items-center justify-between gap-3 text-[0.75rem] font-semibold uppercase tracking-[0.09em] text-[#AEBBD0]">
        <span>Execução do exercício</span>
        <span className="font-medium normal-case tracking-normal">{p.quantidade} emendas</span>
      </h2>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <p className="text-[clamp(2.1rem,4.4vw,3.25rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums">
            {brlCurto(p.total)}
            <span className="ml-2 text-[0.42em] font-medium tracking-normal text-[#AEBBD0]">indicados</span>
          </p>
          <p className="mt-2 text-[0.84375rem] text-[#AEBBD0]">
            Do total, já foi pago <b className="font-semibold text-white">{brlCurto(p.pago)}</b> e empenhado <b className="font-semibold text-white">{brlCurto(p.empenhado)}</b>.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[1.875rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">{pct(p.pago / base, 1)}</p>
          <p className="mt-1 text-[0.78125rem] text-[#AEBBD0]">do indicado já pago</p>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[0.875rem] font-medium" role="status" style={{ backgroundColor: ok ? VERDE.fundo : VERMELHO.fundo, borderColor: ok ? VERDE.borda : VERMELHO.borda, color: ok ? VERDE.texto : VERMELHO.texto }}>
        <span aria-hidden className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: ok ? "#34D399" : "#F87171" }} />
        {ok
          ? "Meta legal atingida: todo o valor aprovado está pago ou empenhado; o que não foi pago fica em restos a pagar."
          : `Meta legal em risco: faltam ${brl(m.semEmpenho)} a empenhar até 31/12 para estar dentro da lei (${pct(m.fracaoDentroDaLei, 1)} já pago ou em restos a pagar).`}
        {m.semEmendaCadastrada > 0.005 && <> {brl(m.semEmendaCadastrada)} do valor aprovado ainda não têm emenda cadastrada.</>}
        {m.tetoRestos != null && (
          <>
            {" "}
            Para os restos a pagar caberem no limite de {brl(m.tetoRestos)}, faltam pagar no mínimo <b>{brl(m.minimoAPagar ?? 0)}</b>.
          </>
        )}
      </p>

      <ul className="mt-3 grid gap-2.5 sm:grid-cols-3" aria-label="Limites da lei">
        {[
          {
            nome: `Obrigação legal: teto das emendas${m.tetoDescricao ? ` (${m.tetoDescricao})` : ""}`,
            valor: m.tetoValor != null ? brlCurto(m.tetoValor) : "—",
            apoio: m.tetoValor == null ? "informe a RCL em Configurações › Exercício" : (m.aprovadoAcimaDoTeto ?? 0) > 0 ? `a Câmara aprovou ${brlCurto(m.aprovadoAcimaDoTeto ?? 0)} acima do teto` : "o aprovado está dentro do teto",
            tom: m.tetoValor == null ? undefined : (m.aprovadoAcimaDoTeto ?? 0) > 0 ? VERMELHO : VERDE,
          },
          {
            nome: "Pode ficar em restos a pagar",
            valor: m.tetoRestos != null ? brlCurto(m.tetoRestos) : "—",
            apoio: m.tetoRestos != null ? (m.tetoRestosDescricao ?? "limite informado") : "limite não informado",
            tom: undefined as Tom | undefined,
          },
          {
            nome: "Mínimo a pagar para esse limite",
            valor: m.minimoAPagar != null ? brlCurto(m.minimoAPagar) : "—",
            apoio: m.minimoAPagar == null ? "depende do limite de restos" : m.minimoAPagar > 0 ? "ainda falta pagar" : "já está dentro do limite",
            tom: m.minimoAPagar == null ? undefined : m.minimoAPagar > 0 ? VERMELHO : VERDE,
          },
        ].map((c) => (
          <li key={c.nome} className="rounded-xl border px-3 py-2" style={c.tom ? { backgroundColor: c.tom.fundo, borderColor: c.tom.borda } : { backgroundColor: "rgba(255,255,255,.07)", borderColor: "transparent" }}>
            <span className="block text-[0.75rem] text-[#AEBBD0]">{c.nome}</span>
            <span className="block text-[1.125rem] font-semibold tabular-nums tracking-[-0.02em]" style={c.tom ? { color: c.tom.texto } : undefined}>
              {c.valor}
            </span>
            <span className="text-[0.75rem] text-[#AEBBD0]">{c.apoio}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex h-4 gap-0.5 overflow-hidden rounded-lg bg-white/10" role="img" aria-label={partes.map((x) => `${x.nome}: ${pct(x.valor / base, 1)}`).join("; ")}>
        {partes.map((x) => (
          <CaixaInfo
            key={x.nome}
            as="span"
            style={{ width: `${(x.valor / base) * 100}%` }}
            className="block h-full"
            conteudo={
              <>
                <CaixaTitulo rotulo={x.nome} valor={brl(x.valor)} lado={pct(x.valor / base, 1)} ladoApoio="do indicado" />
              </>
            }
          >
            <span className="emd-preenche block h-full" style={{ backgroundColor: x.cor }} />
          </CaixaInfo>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {legenda.map((l) => (
          <li key={l.nome}>
            <Link href={l.href} className="block h-full rounded-xl border px-3 py-2.5 transition-colors hover:brightness-125" style={l.tom ? { backgroundColor: l.tom.fundo, borderColor: l.tom.borda } : { backgroundColor: "rgba(255,255,255,.07)", borderColor: "transparent" }}>
              <span className="flex items-center gap-1.5 text-[0.75rem] text-[#AEBBD0]">
                <i className="inline-block h-2 w-2 rounded-[3px]" style={{ backgroundColor: l.cor }} aria-hidden />
                {l.nome}
              </span>
              <span className="mt-0.5 block text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums" style={l.tom ? { color: l.tom.texto } : undefined}>{brlCurto(l.valor)}</span>
              <span className="text-[0.75rem] tabular-nums text-[#AEBBD0]">{l.apoio}</span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Emendas por situação">
        {chips.map((x) => (
          <li key={x.nome}>
            <Link href={x.href} className="inline-flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1.5 pr-3 text-[0.8125rem] transition-colors hover:bg-white/10">
              <b className="grid h-[1.375rem] min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-[0.75rem] tabular-nums" style={{ color: x.cor }}>
                {x.quantidade}
              </b>
              {x.nome}
            </Link>
          </li>
        ))}
      </ul>

      {insight && (
        <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-white/[0.07] px-3.5 py-2.5 text-[0.84375rem] leading-snug text-[#D6DEEB]">
          <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-[#E9A63B]" aria-hidden />
          <span>{insight}</span>
        </p>
      )}

      <div className="mt-auto border-t border-white/15 pt-4">
        <div className="relative mx-2 mb-8 mt-7 h-1.5 rounded-full bg-white/15" role="img" aria-label={`Faltam ${diasFim} dias para o fim do exercício`}>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${fracaoAno * 100}%`, background: "linear-gradient(90deg, #6B4FBB, #B9A6F2)" }} />
          <span className="absolute left-0 top-5 text-[0.71875rem] leading-tight text-[#AEBBD0]">
            <b className="block font-semibold text-[#EAF0F9]">1º de janeiro</b>
          </span>
          <span className="absolute -top-2 h-[1.375rem] w-0.5 bg-[#E9A63B]" style={{ left: `${fracaoAno * 100}%` }}>
            <span className="absolute bottom-[1.75rem] left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.71875rem] font-semibold text-[#E9A63B]">Hoje</span>
          </span>
          <span className="absolute right-0 top-5 text-right text-[0.71875rem] leading-tight text-[#AEBBD0]">
            <b className="block font-semibold text-[#EAF0F9]">31/12</b>
          </span>
        </div>
      </div>
    </section>
  );
}

function Atencao({ itens }: { itens: ItemAtencao[] }) {
  return (
    <section aria-label="O que precisa da sua atenção" data-tour="atencao-emendas" className="emd-entra flex flex-col rounded-2xl border border-slate-200 bg-white" style={{ ["--i" as string]: 1 }}>
      <div className="px-5 pb-1 pt-4">
        <Titulo ver={{ href: "/emendas/pendencias", rotulo: "Ver pendências" }}>Precisa da sua atenção</Titulo>
      </div>
      {itens.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-5 py-10 text-center text-sm text-slate-600">Nada pedindo atenção agora. Bom sinal.</p>
      ) : (
        <ul className="flex flex-1 flex-col px-2 pb-2 pt-1">
          {itens.map((i) => (
            <li key={i.chave} className="flex min-h-[3.25rem] flex-1">
              <Link href={i.href} className="grid w-full grid-cols-[0.5rem_minmax(0,1fr)_auto_0.875rem] items-center gap-x-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-100">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_GRAVIDADE[i.gravidade] }} aria-hidden />
                <span className="min-w-0 text-[0.84375rem] font-medium leading-snug text-cataguases-marinho">
                  {i.titulo}
                  <small className="block text-[0.75rem] font-normal text-slate-600">{i.detalhe}</small>
                </span>
                <span className="text-[1.125rem] font-semibold tracking-tight tabular-nums" style={{ color: COR_GRAVIDADE[i.gravidade] }}>
                  {i.rotuloQuantidade ?? i.quantidade}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-slate-200 px-5 py-2.5 text-[0.78125rem] text-slate-600">Só aparece o que tem alguma emenda envolvida.</p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Por tipo
// ---------------------------------------------------------------------------------------------------------------------

function Tipos({ p, ano }: { p: Painel; ano: number }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-3">
      {p.tipos.map((t, k) => {
        const info = TIPOS_EXECUCAO[t.tipo];
        return (
          <CaixaInfo
            key={t.tipo}
            as="div"
            conteudo={
              <>
                <CaixaTitulo rotulo={info.nome} valor={brl(t.valor)} />
                <CaixaLinhas
                  linhas={[
                    { rotulo: "Empenhado", valor: brl(t.empenhado), cor: COR_DINHEIRO.empenhado },
                    { rotulo: "Pago", valor: brl(t.pago), cor: COR_DINHEIRO.pago },
                    { rotulo: "A pagar", valor: brl(Math.max(0, t.empenhado - t.pago)), cor: COR_DINHEIRO.aPagar },
                  ]}
                />
                <CaixaNota>Clique para abrir só as emendas deste tipo.</CaixaNota>
              </>
            }
          >
            <Link
              href={`/emendas/lista?t=${t.tipo}&ano=${ano}`}
              className="emd-entra emd-ergue flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
              style={{ borderLeft: `6px solid ${info.cor}`, ["--i" as string]: 2 + k }}
            >
              <Anel fracao={t.valor ? t.pago / t.valor : 0} cor={info.cor} rotulo="pago" />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2 font-semibold text-cataguases-marinho">
                  {info.nome}
                  <small className="text-[0.78125rem] font-normal text-slate-600">{t.quantidade} emendas</small>
                </p>
                <p className="mt-0.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-cataguases-marinho">{brlCurto(t.valor)}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[0.78125rem] text-slate-600">
                  <span>
                    Empenhado <b className="font-semibold text-cataguases-marinho">{pct(t.valor ? t.empenhado / t.valor : 0, 0)}</b>
                  </span>
                  <span>
                    <b className="font-semibold text-cataguases-marinho">{t.comPendencia}</b> com pendência
                    {t.altas > 0 && <b className="ml-1 font-semibold text-red-700">· {t.altas} {t.altas > 1 ? "altas" : "alta"}</b>}
                  </span>
                </p>
              </div>
            </Link>
          </CaixaInfo>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Ritmo dos pagamentos e funil
// ---------------------------------------------------------------------------------------------------------------------

function Ritmo({ p, ano, diasFim }: { p: Painel; ano: number; diasFim: number }) {
  const c = p.curva;
  const W = 640, H = 236, L = 38, R = 12, T = 18, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const X = (m: number) => L + (m / 12) * iw;
  const Y = (f: number) => T + ih - f * ih;
  const xs = [0, ...c.pontos.map((pt, i) => (i === c.pontos.length - 1 && c.hojeMes > 0 && diasFim >= 0 ? hojeNoMes(c.hojeMes, diasFim) : pt.mes))];
  const ys = [0, ...c.pontos.map((pt) => pt.fracao)];
  const pts = xs.map((x, i) => [X(x), Y(ys[i])] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const ult = pts[pts.length - 1];
  const area = `${d} L${ult[0].toFixed(1)} ${Y(0)} L${pts[0][0]} ${Y(0)} Z`;
  const emCurso = c.necessarioSemanal !== null;
  const gid = `ritmo-${ano}`;

  return (
    <section aria-label="Ritmo dos pagamentos" className={CARTAO} style={{ ["--i" as string]: 5 }}>
      <Titulo ver={{ href: `/emendas/relatorios?ano=${ano}`, rotulo: "Relatórios" }}>Ritmo dos pagamentos</Titulo>
      <div className="mt-3 flex flex-wrap gap-2">
        <Numero rotulo="Pago até hoje" valor={brlCurto(p.pago)} />
        {emCurso && <Numero rotulo="Média das últimas 8 semanas" valor={brlCurto(c.mediaSemanal)} apoio="por semana" />}
        {emCurso && <Numero rotulo="Para fechar o ano, precisa de" valor={brlCurto(c.necessarioSemanal ?? 0)} apoio="por semana" alerta />}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full overflow-visible" role="img" aria-label={`Pago acumulado: ${pct(c.fracaoHoje, 1)} do indicado até hoje`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={Y(f)} y2={Y(f)} className="stroke-slate-200" strokeDasharray={f ? "3 4" : undefined} />
            <text x={L - 8} y={Y(f) + 4} textAnchor="end" fontSize="11" className="fill-slate-500">
              {Math.round(f * 100)}%
            </text>
          </g>
        ))}
        {MESES.map((m, i) => (
          <text key={m} x={X(i + 0.5)} y={H - 6} textAnchor="middle" fontSize="11" className="fill-slate-500">
            {m}
          </text>
        ))}
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={COR_DINHEIRO.pago} stopOpacity=".35" />
            <stop offset="1" stopColor={COR_DINHEIRO.pago} stopOpacity="0" />
          </linearGradient>
        </defs>
        {pts.length > 1 && <path d={area} fill={`url(#${gid})`} className="emd-preenche" />}
        {emCurso && pts.length > 1 && (
          <>
            <path d={`M${ult[0].toFixed(1)} ${ult[1].toFixed(1)} L${X(12)} ${Y(1)}`} fill="none" stroke={COR_DINHEIRO.aPagar} strokeWidth="2" strokeDasharray="5 5" />
            {c.projecaoFim !== null && <path d={`M${ult[0].toFixed(1)} ${ult[1].toFixed(1)} L${X(12)} ${Y(c.projecaoFim)}`} fill="none" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" className="stroke-slate-500" />}
            <text x={X(12)} y={Y(1) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill={COR_DINHEIRO.aPagar}>
              Meta: 100% em 31/12
            </text>
            {c.projecaoFim !== null && (
              <text x={X(12)} y={Y(c.projecaoFim) + 18} textAnchor="end" fontSize="11" className="fill-slate-500" style={{ paintOrder: "stroke", stroke: "rgb(var(--surface))", strokeWidth: 3.5 }}>
                Ritmo atual: {Math.round(c.projecaoFim * 100)}%
              </text>
            )}
          </>
        )}
        {pts.length > 1 && <path d={d} fill="none" stroke={COR_DINHEIRO.pago} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="emd-traco" />}
        {pts.length > 1 && (
          <>
            <line x1={ult[0]} x2={ult[0]} y1={Y(0)} y2={ult[1]} stroke="#E9A63B" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx={ult[0]} cy={ult[1]} r="5" fill={COR_DINHEIRO.pago} strokeWidth="2" className="stroke-[color:rgb(var(--surface))]" />
            <text x={ult[0] - 9} y={ult[1] - 12} textAnchor="end" fontSize="11" fontWeight="600" className="fill-slate-700" style={{ paintOrder: "stroke", stroke: "rgb(var(--surface))", strokeWidth: 3.5 }}>
              Hoje: {pct(c.fracaoHoje, 1)}
            </text>
          </>
        )}
      </svg>
    </section>
  );
}

/** Posição (em meses, 0–12) de "hoje" dentro do ano, a partir do mês corrente e dos dias que faltam até 31/12. */
function hojeNoMes(mes: number, diasFim: number): number {
  const dias = Math.max(0, 365 - diasFim);
  return Math.min(12, Math.max(mes - 1, (dias / 365) * 12));
}

function Numero({ rotulo, valor, apoio, alerta }: { rotulo: string; valor: string; apoio?: string; alerta?: boolean }) {
  return (
    <div className={cn("min-w-[8.5rem] flex-1 rounded-xl border px-3 py-2", alerta ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
      <span className="block text-[0.71875rem] text-slate-600">{rotulo}</span>
      <b className="text-[1.0625rem] tracking-[-0.02em] tabular-nums text-cataguases-marinho">{valor}</b>
      {apoio && <span className="block text-[0.71875rem] text-slate-600">{apoio}</span>}
    </div>
  );
}

function Funil({ p, ano }: { p: Painel; ano: number }) {
  const maior = Math.max(1, ...p.funil.map((f) => f.quantidade));
  const total = p.funil.reduce((s, f) => s + f.quantidade, 0) || 1;
  return (
    <section aria-label="Onde estão as emendas" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 6 }}>
      <Titulo ver={{ href: `/emendas/lista?ano=${ano}`, rotulo: "Abrir a lista" }}>Onde estão as emendas</Titulo>
      <ol className="mt-3 flex flex-1 flex-col gap-1">
        {p.funil.map((f, i) => (
          <li key={f.chave} className="flex flex-1">
            <CaixaInfo as="div" className="flex w-full" conteudo={<CaixaTitulo rotulo={f.nome} valor={`${f.quantidade} emendas`} lado={pct(f.quantidade / total, 0)} ladoApoio="do total" />}>
              <Link href={`/emendas/lista?ano=${ano}`} className="grid w-full grid-cols-[1.375rem_minmax(0,7.5rem)_minmax(0,1fr)_2.5rem] items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100">
                <span className={cn("grid h-[1.375rem] w-[1.375rem] place-items-center rounded-full text-[0.6875rem] font-semibold", p.gargalo?.nome === f.nome ? "bg-amber-100 text-amber-800" : "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] text-[color:var(--modulo-tinta)]")}>{i + 1}</span>
                <span className="text-[0.8125rem] leading-tight text-cataguases-marinho">{f.nome}</span>
                <span className="h-[1.375rem] overflow-hidden rounded-lg bg-slate-100">
                  <span className="emd-preenche block h-full rounded-lg" style={{ width: `${f.quantidade ? Math.max(4, (f.quantidade / maior) * 100) : 0}%`, backgroundColor: COR_FUNIL[i] }} />
                </span>
                <span className="text-right text-[0.9375rem] font-semibold tabular-nums text-cataguases-marinho">{f.quantidade}</span>
              </Link>
            </CaixaInfo>
          </li>
        ))}
      </ol>
      {p.gargalo && (
        <p className="mt-3 flex items-start gap-2 text-[0.78125rem] leading-snug text-slate-600">
          <span aria-hidden className="text-amber-600">▲</span>
          <span>
            <b className="font-semibold text-amber-700">Onde mais acumula:</b> {p.gargalo.quantidade} emendas estão em <b className="font-semibold text-cataguases-marinho">{p.gargalo.nome}</b>.
          </span>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Vereadores, Saúde e secretarias
// ---------------------------------------------------------------------------------------------------------------------

function Vereadores({ p, ano }: { p: Painel; ano: number }) {
  const [ordem, setOrdem] = React.useState<"pago" | "falta">("pago");
  const linhas = p.vereadores
    .slice()
    .sort((a, b) => (ordem === "pago" ? b.pago / (b.cota || 1) - a.pago / (a.cota || 1) : b.cota - b.pago - (a.cota - a.pago)))
    .slice(0, 8);
  return (
    <section aria-label="Execução por vereador" className={CARTAO} style={{ ["--i" as string]: 7 }}>
      <h2 className={cn(ROTULO, "flex flex-wrap items-center justify-between gap-2")}>
        <span>Execução por vereador</span>
        <span className="inline-flex gap-0.5 rounded-[0.625rem] border border-slate-200 bg-slate-50 p-[3px] font-medium normal-case tracking-normal" role="group" aria-label="Ordenar">
          {(["pago", "falta"] as const).map((o) => (
            <button key={o} type="button" aria-pressed={ordem === o} onClick={() => setOrdem(o)} className={cn("h-7 rounded-lg px-2.5 text-[0.78125rem]", ordem === o ? "bg-white font-semibold text-cataguases-marinho shadow-sm" : "text-slate-600 hover:text-cataguases-marinho")}>
              {o === "pago" ? "Mais pagos" : "Mais a executar"}
            </button>
          ))}
        </span>
      </h2>
      <ul className="mt-3 flex flex-col gap-px">
        {linhas.map((v) => {
          const base = v.cota || 1;
          return (
            <li key={v.id}>
              <CaixaInfo
                as="div"
                conteudo={
                  <>
                    <CaixaTitulo rotulo="Vereador" valor={v.nome} />
                    <CaixaLinhas
                      linhas={[
                        { rotulo: "Indicado", valor: brl(v.cota), forte: true },
                        { rotulo: "Pago", valor: brl(v.pago), cor: COR_DINHEIRO.pago },
                        { rotulo: "Empenhado, a pagar", valor: brl(v.empenhadoAPagar), cor: COR_DINHEIRO.empenhado },
                        { rotulo: "Sem empenhar", valor: brl(v.semEmpenhar), cor: COR_DINHEIRO.semEmpenhar },
                      ]}
                    />
                    <CaixaNota>{v.saudeOk ? "Mínimo de Saúde atendido." : "Abaixo do mínimo de Saúde (alerta)."}</CaixaNota>
                  </>
                }
              >
                <Link href={`/emendas/lista?v=${v.id}&ano=${ano}`} className="grid grid-cols-[1.75rem_minmax(0,9.5rem)_minmax(0,1fr)_2.75rem_1.25rem] items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors hover:bg-slate-100 max-sm:grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_1.25rem]">
                  <span className="font-mono text-[0.75rem] text-slate-500">{String(v.numero).padStart(2, "0")}</span>
                  <span className="truncate text-cataguases-marinho">{v.nome}</span>
                  <span className="flex h-3.5 gap-px overflow-hidden rounded-[5px] bg-slate-100 max-sm:hidden" aria-hidden>
                    <i className="emd-preenche block h-full" style={{ width: `${(v.pago / base) * 100}%`, backgroundColor: COR_DINHEIRO.pago }} />
                    <i className="emd-preenche block h-full" style={{ width: `${(v.empenhadoAPagar / base) * 100}%`, backgroundColor: COR_DINHEIRO.empenhado }} />
                    <i className="emd-preenche block h-full" style={{ width: `${(v.semEmpenhar / base) * 100}%`, backgroundColor: COR_DINHEIRO.semEmpenhar }} />
                  </span>
                  <span className="text-right text-[0.78125rem] font-semibold tabular-nums">{pct(v.pago / base, 0)}</span>
                  <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[0.625rem] font-bold", v.saudeOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")} title={v.saudeOk ? "Mínimo de Saúde atendido" : "Abaixo do mínimo de Saúde"}>
                    {v.saudeOk ? "✓" : "!"}
                  </span>
                </Link>
              </CaixaInfo>
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-slate-600">
        <Marca cor={COR_DINHEIRO.pago}>Pago</Marca>
        <Marca cor={COR_DINHEIRO.empenhado}>Empenhado a pagar</Marca>
        <Marca cor={COR_DINHEIRO.semEmpenhar}>Sem empenhar</Marca>
        <Link href="/emendas/vereadores" className={cn(LINK_TITULO, "ml-auto text-[0.75rem]")}>
          Ver todos
        </Link>
      </p>
    </section>
  );
}

function Marca({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="inline-block h-2 w-2 rounded-[3px]" style={{ backgroundColor: cor }} aria-hidden />
      {children}
    </span>
  );
}

function Medidor({ fracao, minimo, ok }: { fracao: number; minimo: number; ok: boolean }) {
  const cx = 62, cy = 66, r = 50;
  const pt = (f: number): [number, number] => [cx + r * Math.cos(Math.PI * (1 - f)), cy - r * Math.sin(Math.PI * (1 - f))];
  const a0 = pt(0), a1 = pt(1), v = pt(Math.min(1, fracao));
  const mx = Math.cos(Math.PI * (1 - minimo / 100)), my = Math.sin(Math.PI * (1 - minimo / 100));
  return (
    <svg viewBox="0 0 124 78" className="h-[4.875rem] w-[7.75rem] flex-none" role="img" aria-label={`${pct(fracao, 1)} do indicado na Saúde; mínimo de ${minimo}%`}>
      <path d={`M${a0[0]} ${a0[1]} A${r} ${r} 0 0 1 ${a1[0]} ${a1[1]}`} fill="none" strokeWidth="11" strokeLinecap="round" className="stroke-slate-200" />
      <path d={`M${a0[0]} ${a0[1]} A${r} ${r} 0 0 1 ${v[0].toFixed(1)} ${v[1].toFixed(1)}`} fill="none" stroke={ok ? "#059669" : "#D97706"} strokeWidth="11" strokeLinecap="round" pathLength={1} className="emd-traco" />
      <line x1={cx + (r - 9) * mx} y1={cy - (r - 9) * my} x2={cx + (r + 9) * mx} y2={cy - (r + 9) * my} strokeWidth="2" className="stroke-slate-800" />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize="9.5" className="fill-slate-500">
        mínimo {minimo}%
      </text>
    </svg>
  );
}

function SaudeSecretarias({ p }: { p: Painel }) {
  const top = p.secretarias.slice(0, 6);
  const resto = p.secretarias.slice(6);
  const linhas = resto.length ? [...top, { nome: "Demais", total: resto.reduce((s, x) => s + x.total, 0), pago: resto.reduce((s, x) => s + x.pago, 0) }] : top;
  const maior = Math.max(1, ...linhas.map((l) => l.total));
  return (
    <section aria-label="Saúde e secretarias" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 8 }}>
      <Titulo ver={{ href: "/emendas/secretarias", rotulo: "Ver secretarias" }}>Saúde e secretarias</Titulo>
      <CaixaInfo
        as="div"
        conteudo={
          <>
            <CaixaTitulo rotulo="Na Saúde" valor={brl(p.saude.valor)} lado={pct(p.saude.fracao, 1)} ladoApoio={`mínimo ${p.saude.minimoPct}%`} />
            <CaixaNota>O mínimo constitucional é calculado sobre o total indicado do exercício.</CaixaNota>
          </>
        }
      >
        <div className="my-3 flex items-center gap-4">
          <Medidor fracao={p.saude.fracao} minimo={p.saude.minimoPct} ok={p.saude.ok} />
          <div>
            <b className="text-[1.5rem] leading-none tracking-[-0.03em] tabular-nums text-cataguases-marinho">{pct(p.saude.fracao, 1)}</b>
            <span className="block text-[0.78125rem] text-slate-600">do indicado na Saúde · {brlCurto(p.saude.valor)}</span>
            <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold", p.saude.ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
              {p.saude.ok ? `✓ Mínimo de ${p.saude.minimoPct}% atendido` : `Abaixo do mínimo de ${p.saude.minimoPct}%`}
            </span>
          </div>
        </div>
      </CaixaInfo>
      <ul className="flex flex-1 flex-col justify-between gap-1.5 border-t border-slate-200 pt-3">
        {linhas.map((s) => (
          <li key={s.nome}>
            <CaixaInfo as="div" conteudo={<><CaixaTitulo rotulo="Secretaria" valor={s.nome} /><CaixaLinhas linhas={[{ rotulo: "Indicado", valor: brl(s.total), forte: true }, { rotulo: "Pago", valor: brl(s.pago), cor: COR_DINHEIRO.pago, apoio: pct(s.total ? s.pago / s.total : 0, 0) }]} /></>}>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_4.75rem] items-center gap-2.5 text-[0.8125rem] max-sm:grid-cols-[minmax(0,1fr)_4.75rem]">
                <span className="truncate text-cataguases-marinho">{s.nome}</span>
                <span className="flex h-2 overflow-hidden rounded bg-slate-100 max-sm:hidden" aria-hidden>
                  <i className="emd-preenche block h-full" style={{ width: `${(s.pago / maior) * 100}%`, backgroundColor: COR_DINHEIRO.pago }} />
                  <i className="emd-preenche block h-full opacity-60" style={{ width: `${(Math.max(0, s.total - s.pago) / maior) * 100}%`, backgroundColor: COR_DINHEIRO.semEmpenhar }} />
                </span>
                <span className="text-right text-[0.78125rem] font-semibold tabular-nums">{brlCurto(s.total)}</span>
              </div>
            </CaixaInfo>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Atividade e prazos
// ---------------------------------------------------------------------------------------------------------------------

const ICONE_ATIVIDADE = { pagamento: Coins, empenho: FileCheck2, anulacao: Undo2, outro: BookOpenCheck } as const;
const COR_ATIVIDADE = { pagamento: COR_DINHEIRO.pago, empenho: COR_DINHEIRO.empenhado, anulacao: "#94A3B8", outro: "#6B4FBB" } as const;

function Atividade({ p, ano }: { p: Painel; ano: number }) {
  return (
    <section aria-label="Atividade recente" className={CARTAO} style={{ ["--i" as string]: 9 }}>
      <Titulo>Últimos lançamentos</Titulo>
      {p.atividade.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nenhum lançamento financeiro neste exercício ainda.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {p.atividade.map((a, i) => {
            const Icone = ICONE_ATIVIDADE[a.tipo];
            return (
              <li key={`${a.numeroEmenda}-${a.data}-${i}`} className="border-b border-slate-100 last:border-0">
                <Link href={`/emendas/lista?numeros=${a.numeroEmenda}&ano=${ano}`} className="grid grid-cols-[1.875rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-slate-50">
                  <span className="grid h-[1.875rem] w-[1.875rem] place-items-center rounded-full text-white" style={{ backgroundColor: COR_ATIVIDADE[a.tipo] }}>
                    <Icone className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 text-[0.8125rem] text-cataguases-marinho">
                    <b className="font-medium">{a.texto}</b> na emenda {a.numeroEmenda}
                    <small className="block truncate text-[0.75rem] text-slate-600">{a.secretaria}</small>
                  </span>
                  <span className="whitespace-nowrap text-[0.75rem] text-slate-600">{a.quando}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Prazos({ p }: { p: Painel }) {
  return (
    <section aria-label="Próximos prazos" className={cn(CARTAO, "flex flex-col")} style={{ ["--i" as string]: 10 }}>
      <Titulo ver={{ href: "/emendas/pendencias", rotulo: "Ver pendências" }}>O que vence nas próximas semanas</Titulo>
      <ul className="mt-2 flex flex-1 flex-col">
        {p.prazos.map((x) => {
          const cor = x.dias <= 7 ? "bg-red-50 text-red-700" : x.dias <= 21 ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700";
          return (
            <li key={`${x.dias}-${x.titulo}`} className="grid flex-1 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
              <span className={cn("rounded-[0.625rem] px-2 py-1 text-center text-[0.78125rem] font-semibold tabular-nums", cor)}>{x.dias === 0 ? "hoje" : `${x.dias} ${x.dias === 1 ? "dia" : "dias"}`}</span>
              <span className="min-w-0 text-[0.8125rem] text-cataguases-marinho">
                {x.titulo}
                <small className="block text-[0.75rem] text-slate-600">{x.detalhe}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------

export function PainelAbertura({ painel: p, ano, saudacao, dataExtenso, diasFim }: { painel: Painel; ano: number; saudacao: string; dataExtenso: string; diasFim: number }) {
  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-[1.5rem] font-semibold leading-tight tracking-[-0.025em] text-cataguases-marinho text-balance">{saudacao}</h1>
          <p className="mt-0.5 text-[0.875rem] text-slate-600">
            {dataExtenso}
            {diasFim >= 0 && (
              <>
                {" "}
                · faltam <b className="font-semibold text-cataguases-marinho">{diasFim} dias</b> para o fim do exercício de {ano}
              </>
            )}
          </p>
        </div>
      </header>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Hero p={p} ano={ano} diasFim={diasFim} />
        <Atencao itens={p.atencao} />
      </div>
      <Tipos p={p} ano={ano} />
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Ritmo p={p} ano={ano} diasFim={diasFim} />
        <Funil p={p} ano={ano} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Vereadores p={p} ano={ano} />
        <SaudeSecretarias p={p} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Atividade p={p} ano={ano} />
        <Prazos p={p} />
      </div>
    </div>
  );
}
