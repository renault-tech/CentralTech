"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Cartao, Kpi } from "@/components/emendas/ui";
import {
  ETAPAS,
  GRUPOS_EXECUCAO,
  alertas as calcularAlertas,
  brl,
  brlCurto,
  cumpreSaude,
  curvaPagamentos,
  indicadores,
  infoEtapa,
  numeroVereador,
  pct,
  porEtapa,
  porSecretaria,
  porVereador,
} from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { EmendaResumo, Exercicio, Secretaria, Vereador } from "@/types/emendas";
import type { MovimentoResumo } from "@/lib/emendas/dados";

type Filtros = { v: string; s: string; saude: string; mod: string; etapa: string };
const CHAVES: (keyof Filtros)[] = ["v", "s", "saude", "mod", "etapa"];

const ESTILO_SELECT =
  "h-[38px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";

/**
 * Painel do gestor: tudo calculado no cliente sobre as emendas do
 * exercício que a pessoa pode ver (RLS) — poucas centenas de linhas por
 * ano, então filtrar/cruzar aqui é instantâneo e não volta ao servidor.
 * Os filtros vivem na URL (`?v=…&s=…`): qualquer recorte pode ser
 * compartilhado por link. Clicar numa barra filtra o painel inteiro
 * (filtro cruzado); cada gráfico ignora o próprio filtro, para continuar
 * mostrando as alternativas.
 */
export function PainelEmendas({
  emendas,
  movimentos,
  vereadores,
  secretarias,
  exercicio,
  anos,
  hoje,
}: {
  emendas: EmendaResumo[];
  movimentos: MovimentoResumo[];
  vereadores: Vereador[];
  secretarias: Secretaria[];
  exercicio: Exercicio;
  anos: number[];
  /** AAAA-MM-DD, do servidor (evita divergência de hidratação). */
  hoje: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const f: Filtros = { v: params.get("v") ?? "", s: params.get("s") ?? "", saude: params.get("saude") ?? "", mod: params.get("mod") ?? "", etapa: params.get("etapa") ?? "" };

  function definir(mudancas: Partial<Filtros> & { ano?: string }) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }
  const alternar = (k: keyof Filtros, valor: string) => definir({ [k]: f[k] === valor ? "" : valor });

  const passa = (r: EmendaResumo, ignorar?: keyof Filtros) =>
    (ignorar === "v" || !f.v || r.vereador_id === f.v) &&
    (ignorar === "s" || !f.s || r.secretaria_id === f.s) &&
    (ignorar === "saude" || !f.saude || String(Number(r.saude)) === f.saude) &&
    (ignorar === "mod" || !f.mod || r.modalidade === f.mod) &&
    (ignorar === "etapa" || !f.etapa || r.etapa === f.etapa);

  const filtradas = emendas.filter((r) => passa(r));
  const ind = indicadores(filtradas);
  const temFiltro = CHAVES.some((k) => f[k]);
  const recorteSoVereadorOuNada = !f.s && !f.saude && !f.mod && !f.etapa;

  // ----- por vereador
  const linhasV = porVereador(emendas.filter((r) => passa(r, "v")), vereadores);
  const maxV = Math.max(1, ...linhasV.map((l) => l.total));

  // ----- funil
  const funil = porEtapa(emendas.filter((r) => passa(r, "etapa")));
  const totalFunil = Math.max(1, funil.reduce((t, x) => t + x.valor, 0));

  // ----- secretarias
  const linhasS = porSecretaria(emendas.filter((r) => passa(r, "s")));
  const maxS = Math.max(1, ...linhasS.map((l) => l.total));

  // ----- curva (pagamentos das emendas filtradas)
  const ids = new Set(filtradas.map((r) => r.id));
  const pagamentos = movimentos.filter((m) => m.tipo === "pagamento" && ids.has(m.emenda_id));
  const { acumulado, semData } = curvaPagamentos(pagamentos, exercicio.ano);
  const dataHoje = new Date(`${hoje}T12:00:00`);
  const mesHoje = dataHoje.getFullYear() === exercicio.ano ? dataHoje.getMonth() + dataHoje.getDate() / 31 : dataHoje.getFullYear() > exercicio.ano ? 12 : 0;

  // ----- alertas
  const listaAlertas = calcularAlertas(filtradas, movimentos.filter((m) => ids.has(m.emenda_id)), {
    hoje: dataHoje,
    ano: exercicio.ano,
    diasParado: 30,
  });

  const resumo = [
    f.v && vereadores.find((v) => v.id === f.v)?.nome,
    f.s && secretarias.find((s) => s.id === f.s)?.nome,
    f.etapa && infoEtapa(f.etapa).nome,
    f.saude === "1" ? "Saúde" : f.saude === "0" ? "Fora da Saúde" : "",
    f.mod === "repasse" ? "Repasse a entidade" : f.mod === "direta" ? "Aplicação direta" : "",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Filtros" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5" data-tour="filtros-emendas">
        <Campo rotulo="Exercício">
          <select className={ESTILO_SELECT} value={String(exercicio.ano)} onChange={(e) => definir({ ano: e.target.value })}>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Vereador">
          <select className={cn(ESTILO_SELECT, "min-w-[220px]")} value={f.v} onChange={(e) => definir({ v: e.target.value })}>
            <option value="">Todos os vereadores</option>
            {vereadores.map((v) => (
              <option key={v.id} value={v.id}>
                {numeroVereador(v.numero)} · {v.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Secretaria">
          <select className={cn(ESTILO_SELECT, "min-w-[200px]")} value={f.s} onChange={(e) => definir({ s: e.target.value })}>
            <option value="">Todas as secretarias</option>
            {secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Saúde">
          <select className={ESTILO_SELECT} value={f.saude} onChange={(e) => definir({ saude: e.target.value })}>
            <option value="">Todas</option>
            <option value="1">Só Saúde</option>
            <option value="0">Fora da Saúde</option>
          </select>
        </Campo>
        <Campo rotulo="Modalidade">
          <select className={ESTILO_SELECT} value={f.mod} onChange={(e) => definir({ mod: e.target.value })}>
            <option value="">Todas</option>
            <option value="repasse">Repasse a entidade</option>
            <option value="direta">Aplicação direta</option>
          </select>
        </Campo>
        <Campo rotulo="Etapa">
          <select className={ESTILO_SELECT} value={f.etapa} onChange={(e) => definir({ etapa: e.target.value })}>
            <option value="">Todas</option>
            {ETAPAS.map((e) => (
              <option key={e.chave} value={e.chave}>
                {e.nome}
              </option>
            ))}
          </select>
        </Campo>
        {temFiltro && (
          <button
            type="button"
            onClick={() => definir({ v: "", s: "", saude: "", mod: "", etapa: "" })}
            className="h-[38px] rounded-lg border border-violet-200 bg-violet-50 px-3.5 text-sm font-medium text-violet-900 hover:bg-violet-100"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto self-center text-sm text-slate-600">
          {resumo.length > 0 && <>Recorte: {resumo.join(" · ")} · </>}
          {filtradas.length} de {emendas.length} emendas
        </span>
      </section>

      <section aria-label="Indicadores" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3" data-tour="indicadores-emendas">
        <Kpi rotulo="Total indicado" valor={brlCurto(ind.total)} apoio={`${ind.quantidade} emendas no recorte`} barra={1} corBarra="#0C1D33" />
        <Kpi rotulo="Empenhado" valor={brlCurto(ind.empenhado)} apoio={`${pct(ind.empenhado / (ind.total || 1))} do indicado`} barra={ind.empenhado / (ind.total || 1)} corBarra="#9479DD" />
        <Kpi rotulo="Pago" valor={brlCurto(ind.pago)} apoio={`${ind.quantidadePagas} emendas pagas`} barra={ind.pago / (ind.total || 1)} corBarra="#563A9E" corValor="#4C3494" />
        <Kpi rotulo="A executar" valor={brlCurto(ind.aExecutar)} apoio={`${ind.quantidade - ind.quantidadePagas} emendas em aberto`} barra={ind.aExecutar / (ind.total || 1)} corBarra="#CBD5E1" />
        {(() => {
          const p = ind.total ? ind.saude / ind.total : 0;
          const ok = p * 100 + 0.0001 >= exercicio.percentual_saude_min;
          return (
            <Kpi
              rotulo="Na Saúde"
              valor={pct(p)}
              apoio={`${brlCurto(ind.saude)} · ${ok ? `mínimo de ${exercicio.percentual_saude_min}% atendido` : `abaixo de ${exercicio.percentual_saude_min}%`}`}
              barra={p}
              corBarra={ok ? "#16A34A" : "#D97706"}
              corValor={ok ? "#166534" : "#92400E"}
            />
          );
        })()}
        <Kpi rotulo="Impedidas" valor={String(ind.impedidas)} apoio={`${ind.remanejadas} com remanejamento no histórico`} barra={ind.quantidade ? ind.impedidas / ind.quantidade : 0} corBarra="#D97706" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao titulo="Execução por vereador" apoio="Clique num vereador para filtrar o painel">
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
            {GRUPOS_EXECUCAO.map((g) => (
              <span key={g.grupo} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.cor }} aria-hidden />
                {g.nome}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {linhasV.map((l) => {
              const ativo = f.v === l.vereadorId;
              const ok = cumpreSaude(l.saude, exercicio.cota_por_vereador, exercicio.percentual_saude_min);
              return (
                <button
                  key={l.vereadorId}
                  type="button"
                  onClick={() => alternar("v", l.vereadorId)}
                  aria-pressed={ativo}
                  title={`${l.nome}: ${brl(l.total)} indicados, ${brl(l.pago)} pagos`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_minmax(90px,1fr)_40px] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-violet-50 sm:grid-cols-[minmax(140px,200px)_1fr_48px_70px] sm:gap-2.5",
                    ativo && "bg-violet-50",
                    f.v && !ativo && "opacity-50"
                  )}
                >
                  <span className="truncate text-[13px] text-cataguases-marinho">
                    <span className="font-mono text-slate-500">{numeroVereador(l.numero)}</span> {l.nome}
                  </span>
                  <span className="flex h-3.5 overflow-hidden rounded bg-slate-100">
                    {[3, 2, 1, 0].map((g) =>
                      l.grupos[g] > 0 ? (
                        <span key={g} style={{ width: `${(l.grupos[g] / maxV) * 100}%`, backgroundColor: GRUPOS_EXECUCAO[3 - g].cor }} />
                      ) : null
                    )}
                  </span>
                  <span className="text-right text-xs font-semibold tabular-nums">{l.total ? pct(l.pago / l.total, 0) : "—"}</span>
                  <span
                    className={cn(
                      "hidden rounded-full px-1.5 py-0.5 text-center text-[11px] sm:inline",
                      !recorteSoVereadorOuNada || !l.total ? "bg-slate-100 text-slate-500" : ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"
                    )}
                  >
                    {recorteSoVereadorOuNada && l.total ? `Saúde ${Math.round((l.saude / exercicio.cota_por_vereador) * 100)}%` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Barra = valor indicado (100% = maior total no recorte). % = parcela já paga. Selo = parcela da cota na Saúde (mínimo{" "}
            {exercicio.percentual_saude_min}%).
          </p>
        </Cartao>

        <div className="flex flex-col gap-5">
          <Cartao titulo="Funil de execução" apoio="Valor por etapa · clique para filtrar">
            <div className="flex flex-col gap-1">
              {funil.map(({ etapa, quantidade, valor }) => {
                const ativo = f.etapa === etapa.chave;
                return (
                  <button
                    key={etapa.chave}
                    type="button"
                    onClick={() => alternar("etapa", etapa.chave)}
                    aria-pressed={ativo}
                    className={cn("grid grid-cols-[118px_1fr_84px] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-violet-50 sm:grid-cols-[150px_1fr_96px] sm:gap-2.5", ativo && "bg-violet-50")}
                  >
                    <span className="flex items-center gap-2 text-[13px] text-cataguases-marinho">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: etapa.cor }} aria-hidden />
                      {etapa.nome}
                    </span>
                    <span className="h-[18px] overflow-hidden rounded bg-slate-50">
                      <span className="block h-[18px] rounded" style={{ width: `${(valor / totalFunil) * 100}%`, backgroundColor: etapa.cor }} />
                    </span>
                    <span className="text-right text-xs tabular-nums text-slate-700">
                      <strong>{quantidade}</strong> · {brlCurto(valor)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Cartao>

          <Cartao titulo="Composição">
            <Divisao
              a="Saúde"
              b="Demais áreas"
              va={ind.saude}
              vb={ind.total - ind.saude}
              cor="#16A34A"
              apoioA={brlCurto(ind.saude)}
              apoioB={brlCurto(ind.total - ind.saude)}
            />
            {(() => {
              const rep = filtradas.filter((r) => r.modalidade === "repasse");
              const valRep = rep.reduce((t, r) => t + r.valor, 0);
              return (
                <Divisao
                  a="Repasse a entidades"
                  b="Aplicação direta"
                  va={valRep}
                  vb={ind.total - valRep}
                  cor="#2563A8"
                  apoioA={`${rep.length} emendas`}
                  apoioB={`${filtradas.length - rep.length} emendas`}
                />
              );
            })()}
          </Cartao>
        </div>

        <Cartao
          titulo={`Curva de pagamentos em ${exercicio.ano}`}
          apoio={
            <span className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-3.5 bg-[#563A9E]" aria-hidden />
                Pago acumulado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 border-t-2 border-dashed border-slate-400" aria-hidden />
                Ritmo linear até dezembro
              </span>
            </span>
          }
        >
          <Curva acumulado={acumulado} total={ind.total} mesHoje={mesHoje} />
          <p className="mt-1.5 text-xs text-slate-500">
            Pago até hoje: {brl(acumulado[Math.max(0, Math.min(11, Math.floor(mesHoje)))] ?? 0)}
            {mesHoje > 0 && mesHoje < 12 && <> · no ritmo linear, o esperado para hoje seria {brl((ind.total * mesHoje) / 12)}</>}
            .{semData > 0 && <> {brlCurto(semData)} pagos sem data ficam fora da curva.</>}
          </p>
        </Cartao>

        <Cartao
          titulo="Por secretaria"
          apoio={
            <span className="flex gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#DDD6F7]" aria-hidden />
                Indicado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#563A9E]" aria-hidden />
                Pago
              </span>
            </span>
          }
        >
          <div className="flex flex-col gap-0.5">
            {linhasS.map((l) => {
              const ativo = f.s === l.secretariaId;
              return (
                <button
                  key={l.secretariaId}
                  type="button"
                  onClick={() => alternar("s", l.secretariaId)}
                  aria-pressed={ativo}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_minmax(70px,1fr)_104px] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-violet-50 sm:grid-cols-[minmax(110px,170px)_1fr_120px] sm:gap-2.5",
                    ativo && "bg-violet-50",
                    f.s && !ativo && "opacity-50"
                  )}
                >
                  <span className="truncate text-[13px] text-cataguases-marinho">{l.nome}</span>
                  <span className="relative h-4 overflow-hidden rounded bg-slate-50">
                    <span className="absolute inset-y-0 left-0 rounded bg-[#DDD6F7]" style={{ width: `${(l.total / maxS) * 100}%` }} />
                    <span className="absolute inset-y-0 left-0 rounded bg-[#563A9E]" style={{ width: `${(l.pago / maxS) * 100}%` }} />
                  </span>
                  <span className="text-right text-xs tabular-nums text-slate-700">
                    {brlCurto(l.total)} · <strong>{pct(l.pago / l.total, 0)}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </Cartao>
      </div>

      <Cartao titulo="Alertas e pendências" apoio="Calculados sobre o recorte atual">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
          {listaAlertas.map((a) => {
            const tom =
              a.nivel === "atencao"
                ? { borda: "border-amber-200", fundo: "bg-amber-50", ic: "bg-amber-100 text-amber-900" }
                : a.nivel === "ok"
                  ? { borda: "border-green-200", fundo: "bg-green-50", ic: "bg-green-100 text-green-800" }
                  : { borda: "border-slate-200", fundo: "bg-slate-50", ic: "bg-indigo-100 text-indigo-900" };
            const conteudo = (
              <>
                <span className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[15px] font-bold", tom.ic)}>{a.quantidade}</span>
                <span className="flex flex-col gap-0.5">
                  <strong className="text-[13px] text-cataguases-marinho">{a.titulo}</strong>
                  <span className="text-xs text-slate-600">{a.detalhe}</span>
                </span>
              </>
            );
            return a.numeros.length > 0 ? (
              <Link
                key={a.chave}
                href={`/emendas/lista?ano=${exercicio.ano}&numeros=${a.numeros.join(",")}`}
                className={cn("flex items-start gap-3 rounded-lg border p-3.5 transition-shadow hover:shadow-sm", tom.borda, tom.fundo)}
              >
                {conteudo}
              </Link>
            ) : (
              <div key={a.chave} className={cn("flex items-start gap-3 rounded-lg border p-3.5", tom.borda, tom.fundo)}>
                {conteudo}
              </div>
            );
          })}
        </div>
      </Cartao>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {rotulo}
      {children}
    </label>
  );
}

function Divisao({ a, b, va, vb, cor, apoioA, apoioB }: { a: string; b: string; va: number; vb: number; cor: string; apoioA: string; apoioB: string }) {
  const total = va + vb || 1;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span>
          {a} <strong>{pct(va / total)}</strong>
        </span>
        <span>
          {b} <strong>{pct(vb / total)}</strong>
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <span style={{ width: `${(va / total) * 100}%`, backgroundColor: cor }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{apoioA}</span>
        <span>{apoioB}</span>
      </div>
    </div>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function Curva({ acumulado, total, mesHoje }: { acumulado: number[]; total: number; mesHoje: number }) {
  const X0 = 56;
  const X1 = 628;
  const Y0 = 232;
  const Y1 = 20;
  const mx = (m: number) => X0 + (X1 - X0) * (m / 12);
  const my = (v: number) => Y0 - (Y0 - Y1) * (total ? v / total : 0);
  const ultimoMes = Math.max(0, Math.min(12, Math.ceil(mesHoje)));
  const pontos = [{ x: mx(0), y: my(0), v: 0, m: 0 }, ...acumulado.slice(0, ultimoMes).map((v, i) => ({ x: mx(i + 1), y: my(v), v, m: i + 1 }))];
  const linha = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${linha} ${pontos[pontos.length - 1].x.toFixed(1)},${Y0} ${mx(0)},${Y0}`;
  const final = acumulado[Math.max(0, ultimoMes - 1)] ?? 0;

  return (
    <svg viewBox="0 0 640 260" role="img" aria-label={`Pago acumulado: ${brl(final)} de ${brl(total)}`} className="h-auto w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={X0} x2={X1} y1={my(total * f)} y2={my(total * f)} stroke="#EEF2F7" />
          <text x={50} y={my(total * f) + 3} textAnchor="end" fontSize={10} fill="#64748B">
            {brlCurto(total * f).replace("R$ ", "")}
          </text>
        </g>
      ))}
      {MESES.map((m, i) => (
        <text key={m} x={mx(i + 0.5)} y={252} textAnchor="middle" fontSize={10} fill="#64748B">
          {m}
        </text>
      ))}
      {mesHoje > 0 && mesHoje < 12 && (
        <g>
          <line x1={mx(mesHoje)} x2={mx(mesHoje)} y1={16} y2={Y0} stroke="#E9A63B" strokeWidth={1.5} />
          <text x={mx(mesHoje)} y={12} textAnchor="middle" fontSize={10} fill="#8A5E00">
            hoje
          </text>
        </g>
      )}
      <polyline points={`${mx(0)},${my(0)} ${mx(12)},${my(total)}`} fill="none" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 4" />
      <polygon points={area} fill="rgba(107,79,187,0.12)" />
      <polyline points={linha} fill="none" stroke="#563A9E" strokeWidth={2.5} strokeLinejoin="round" />
      {pontos.slice(1).map((p) => (
        <circle key={p.m} cx={p.x} cy={p.y} r={3.5} fill="#FFFFFF" stroke="#563A9E" strokeWidth={2}>
          <title>{`Até ${MESES[p.m - 1]}: ${brl(p.v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
