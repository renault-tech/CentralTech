"use client";

import Link from "next/link";

import { MenuExportar } from "@/components/emendas/menu-exportar";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE, type Gravidade } from "@/lib/emendas/pendencias";
import {
  agruparPendencias,
  descreverFiltros,
  documentosFaltando,
  filtrarPendencias,
  indicadores,
  nomeDaRegra,
  porArea,
  porAssunto,
  porSecretaria,
  type ChaveFiltro,
  type EmendaPainel,
  type FiltrosPainel,
  type Grupo,
  type LinhaDocFaltando,
  type LinhaPendencia,
} from "@/lib/emendas/painel-pendencias";
import { brlCurto, pct } from "@/lib/emendas/regras";

const COR: Record<Gravidade, string> = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" };
const ZERO = { alta: 0, media: 0, baixa: 0, total: 0, emendas: 0, valor: 0 };

type ItemBarra = Grupo & { cor?: string };

/** Uma linha por grupo: nome e total em cima, barra empilhada por gravidade, emendas e valor embaixo. Clicar filtra a lista. */
function Barras({
  titulo,
  dica,
  itens,
  selecionada,
  aoEscolher,
}: {
  titulo: string;
  dica?: string;
  itens: ItemBarra[];
  selecionada: string;
  aoEscolher: (chave: string) => void;
}) {
  const maximo = Math.max(1, ...itens.map((i) => i.total));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-cataguases-marinho">{titulo}</h3>
      {dica && <p className="mt-0.5 text-xs text-slate-600">{dica}</p>}
      <ul className="mt-3 flex flex-col gap-1">
        {itens.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Nada a mostrar com esses filtros.</li>}
        {itens.map((i) => {
          const ativo = selecionada === i.chave;
          const detalhe = `${i.total} pendências (${i.alta} altas, ${i.media} médias, ${i.baixa} baixas) em ${i.emendas} emendas, ${brlCurto(i.valor)}`;
          return (
            <li key={i.chave}>
              <button
                type="button"
                aria-pressed={ativo}
                aria-label={`${i.rotulo}: ${detalhe}`}
                title={detalhe}
                onClick={() => aoEscolher(ativo ? "" : i.chave)}
                className={`block min-h-11 w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none sm:min-h-0 ${
                  ativo ? "border-[var(--modulo)] bg-violet-50/60" : "border-transparent hover:bg-slate-50"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-cataguases-marinho">{i.rotulo}</span>
                  <span className="font-semibold tabular-nums text-cataguases-marinho">{i.total}</span>
                </span>
                <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  {i.cor ? (
                    <span style={{ width: `${(i.total / maximo) * 100}%`, backgroundColor: i.cor }} />
                  ) : (
                    (["alta", "media", "baixa"] as const).map((g) => <span key={g} style={{ width: `${(i[g] / maximo) * 100}%`, backgroundColor: COR[g] }} />)
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] tabular-nums text-slate-600">
                  {i.emendas} {i.emendas === 1 ? "emenda" : "emendas"} · {brlCurto(i.valor)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Indicador({ rotulo, valor, apoio, cor }: { rotulo: string; valor: string; apoio?: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:break-inside-avoid">
      <p className="text-xs font-medium text-slate-600">{rotulo}</p>
      <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-tight" style={cor ? { color: cor } : undefined}>
        <span className={cor ? "" : "text-cataguases-marinho"}>{valor}</span>
      </p>
      {apoio && <p className="mt-1.5 text-xs text-slate-600">{apoio}</p>}
    </div>
  );
}

/**
 * Dimensão das pendências: números do topo e gráficos por gravidade, área, assunto, secretaria e tipo,
 * mais os documentos que faltam. Responde aos mesmos filtros da lista e, ao clicar numa barra, filtra a lista.
 * Cada gráfico ignora o próprio filtro, para sempre mostrar todas as opções e quanto cada uma pesa.
 */
export function PainelPendencias({
  linhas,
  docs,
  emendas,
  secretarias,
  filtros,
  definir,
  ano,
  consulta,
}: {
  linhas: LinhaPendencia[];
  docs: LinhaDocFaltando[];
  emendas: EmendaPainel[];
  secretarias: { id: string; nome: string }[];
  filtros: FiltrosPainel;
  definir: (m: Record<string, string>) => void;
  ano: number;
  /** Filtros atuais na URL, repassados ao Excel para sair com o mesmo recorte. */
  consulta: string;
}) {
  const f = filtros;
  const sem = (...c: ChaveFiltro[]) => filtrarPendencias(linhas, f, c);
  const filtradas = filtrarPendencias(linhas, f);
  const ind = indicadores(filtradas, linhas, emendas, f);

  const gravidades: ItemBarra[] = (["alta", "media", "baixa"] as const).map((g) => {
    const achado = agruparPendencias(sem("g"), (l) => ({ chave: l.gravidade, rotulo: NOME_GRAVIDADE[l.gravidade] })).find((x) => x.chave === g);
    return { ...ZERO, ...(achado ?? {}), chave: g, rotulo: NOME_GRAVIDADE[g], cor: COR[g] };
  });
  const areas = porArea(sem("a", "r"));
  const assuntosTodos = porAssunto(sem("r"));
  const assuntos = [...assuntosTodos.slice(0, 10), ...assuntosTodos.slice(10).filter((x) => x.chave === f.r)];
  const secs = porSecretaria(sem("s"));
  const tipos: ItemBarra[] = ORDEM_TIPOS.map((t) => {
    const achado = agruparPendencias(sem("t"), (l) => ({ chave: l.tipo, rotulo: l.tipo })).find((x) => x.chave === t);
    return { ...ZERO, ...(achado ?? {}), chave: t, rotulo: TIPOS_EXECUCAO[t].nome, cor: TIPOS_EXECUCAO[t].cor };
  });
  const faltando = documentosFaltando(docs, f);
  const maisDocs = Math.max(1, ...faltando.map((g) => g.emendas.length));
  const totalDocs = faltando.reduce((s, g) => s + g.emendas.length, 0);
  const emendasSemDoc = new Set(faltando.flatMap((g) => g.emendas.map((e) => e.emendaId))).size;

  const descricao = descreverFiltros(f, {
    tipo: f.t ? TIPOS_EXECUCAO[f.t as keyof typeof TIPOS_EXECUCAO]?.nome : undefined,
    gravidade: f.g ? NOME_GRAVIDADE[f.g as Gravidade] : undefined,
    secretaria: secretarias.find((s) => s.id === f.s)?.nome,
    assunto: f.r ? nomeDaRegra(linhas.find((l) => l.regra.split(":")[0] === f.r) ?? { regra: f.r, titulo: f.r }) : undefined,
  });

  return (
    <section aria-label="Visão geral das pendências" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-cataguases-marinho">Visão geral</h2>
          <p className="text-xs text-slate-600">
            Clique numa barra para filtrar a lista. <span className="print:hidden">Os filtros acima também mudam os gráficos.</span>
          </p>
        </div>
        <MenuExportar
          opcoes={[
            { rotulo: "Excel (.xlsx)", detalhe: "Totais por corte e a lista, com os filtros atuais", href: `/emendas/pendencias/exportar?${consulta}` },
            { rotulo: "PDF (imprimir)", detalhe: "Só o painel, com os filtros atuais", imprimir: true },
          ]}
        />
      </div>
      <p className="hidden text-xs text-slate-600 print:block">
        Exercício {ano} · Filtros: {descricao} · Gerado em {new Date().toLocaleDateString("pt-BR")}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Pendências abertas" valor={String(ind.pendencias)} apoio={ind.justificadas > 0 ? `${ind.justificadas} justificadas ficam fora` : "Justificadas ficam fora"} />
        <Indicador rotulo="Altas" valor={String(ind.altas)} cor={ind.altas > 0 ? COR.alta : undefined} apoio={`${ind.pendencias ? pct(ind.altas / ind.pendencias, 0) : "0%"} do total`} />
        <Indicador
          rotulo="Emendas afetadas"
          valor={`${ind.emendasAfetadas}`}
          apoio={`de ${ind.emendasNoRecorte} (${ind.emendasNoRecorte ? pct(ind.emendasAfetadas / ind.emendasNoRecorte, 0) : "0%"})`}
        />
        <Indicador
          rotulo="Valor das emendas afetadas"
          valor={brlCurto(ind.valorAfetado)}
          apoio={`de ${brlCurto(ind.valorNoRecorte)} (${ind.valorNoRecorte ? pct(ind.valorAfetado / ind.valorNoRecorte, 0) : "0%"})`}
        />
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Barras titulo="Por gravidade" itens={gravidades} selecionada={f.g} aoEscolher={(c) => definir({ g: c })} />
        <Barras titulo="Por área" itens={areas} selecionada={f.a} aoEscolher={(c) => definir({ a: c, r: "" })} />
        <Barras titulo="Por assunto" dica="Os 10 assuntos com mais pendências." itens={assuntos} selecionada={f.r} aoEscolher={(c) => definir({ r: c })} />
        <Barras titulo="Por secretaria" itens={secs} selecionada={f.s} aoEscolher={(c) => definir({ s: c })} />
        <Barras titulo="Por tipo de execução" itens={tipos} selecionada={f.t} aoEscolher={(c) => definir({ t: c })} />

        <section className="rounded-xl border border-slate-200 bg-white p-4 print:break-inside-avoid">
          <h3 className="text-sm font-semibold text-cataguases-marinho">Documentos faltando</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Exigidos por lei e ainda não ligados no Drive (repasses; execução direta não tem). Vale o filtro de tipo, secretaria e busca.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {faltando.length === 0 && <li className="py-4 text-center text-sm text-slate-500">Nenhum documento faltando neste recorte.</li>}
            {faltando.map((g) => (
              <li key={g.doc} className="rounded-lg px-2.5 py-1.5">
                <details>
                  <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--modulo)]">
                    <span className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate text-cataguases-marinho">{g.rotulo}</span>
                      <span className="font-semibold tabular-nums text-cataguases-marinho">{g.emendas.length}</span>
                    </span>
                    <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <span style={{ width: `${(g.emendas.length / maisDocs) * 100}%`, backgroundColor: "var(--modulo)" }} />
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-slate-600">
                      {g.emendas.length} emendas · {brlCurto(g.valor)} · <span className="print:hidden">ver quais</span>
                    </span>
                  </summary>
                  <p className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                    {g.emendas.map((e) => (
                      <Link
                        key={e.emendaId}
                        href={`/emendas/${e.emendaId}?aba=documentacao`}
                        title={e.secretaria}
                        className="inline-flex h-7 items-center rounded-full border border-slate-300 bg-white px-2.5 font-mono text-xs text-cataguases-marinho hover:bg-slate-50"
                      >
                        {e.numero}
                      </Link>
                    ))}
                  </p>
                </details>
              </li>
            ))}
          </ul>
          {faltando.length > 0 && (
            <p className="mt-2 border-t border-slate-200 pt-2 text-xs tabular-nums text-slate-600">
              {totalDocs} documentos faltando em {emendasSemDoc} emendas.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
