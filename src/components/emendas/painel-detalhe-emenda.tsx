"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Check, X } from "lucide-react";

import { AnelAndamento } from "@/components/emendas/anel-andamento";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { DetalheEmendaCliente, type AbaEmenda } from "@/components/emendas/detalhe-emenda";
import { PainelParceria } from "@/components/emendas/painel-parceria";
import { PainelTransparencia } from "@/components/emendas/painel-transparencia";
import { VinculoCompras } from "@/components/emendas/vinculo-compras";
import { carregarPacoteDetalhe, type PacoteDetalhe } from "@/lib/emendas/actions-painel";
import { identificadorDaFicha } from "@/lib/emendas/conformidade";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { Chip, SeloEtapa } from "@/components/emendas/ui";
import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { NOME_GRAVIDADE } from "@/lib/emendas/pendencias";
import { brl, dataBr, numeroVereador, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const COR_GRAVIDADE = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" } as const;

function Barra({ rotulo, valor, total, cor, detalhe }: { rotulo: string; valor: number; total: number; cor: string; detalhe: string }) {
  const p = total > 0 ? Math.min(1, Math.max(0, valor / total)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="text-slate-600">{rotulo}</span>
        <span className="font-semibold tabular-nums text-cataguases-marinho">{brl(valor)}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="emd-preenche h-full rounded-full" style={{ width: `${p * 100}%`, background: `linear-gradient(90deg, ${cor}, color-mix(in srgb, ${cor} 70%, white))` }} />
      </div>
      <p className="text-xs tabular-nums text-slate-500">{detalhe}</p>
    </div>
  );
}

type AbaPainel = "resumo" | "parceria" | Extract<AbaEmenda, "fases" | "documentacao" | "pendencias" | "financeiro" | "andamentos" | "historico">;

const CLASSE_TITULO = "text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500";

function Esqueleto() {
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none" role="status" aria-label="Carregando os detalhes da emenda">
      <div className="h-4 w-1/3 rounded bg-slate-200/70" />
      <div className="h-24 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/4 rounded bg-slate-200/70" />
      <div className="h-32 rounded-xl bg-slate-100" />
    </div>
  );
}

/**
 * Painel à direita da lista: a emenda escolhida sem sair da lista. A aba "Resumo" usa só o que a lista já carregou; as demais
 * (Fases, Documentação, Pendências, Financeiro, Andamentos, Parceria, Histórico) são as mesmas da página da emenda, carregadas
 * na primeira vez que se abre uma delas (ou ao passar o mouse na faixa de abas) e gravam pelas mesmas ações.
 */
export function PainelDetalheEmenda({ emenda: e, resumo, aoFechar }: { emenda: EmendaResumo; resumo?: ResumoLinha; aoFechar: () => void }) {
  const catalogo = useCatalogo();
  const router = useRouter();
  const tipo = tipoDaEmenda(e);
  const cor = TIPOS_EXECUCAO[tipo].cor;
  const aPagar = Math.max(0, e.empenhado - e.pago);
  const semEmpenhar = Math.max(0, e.valor - e.empenhado);
  const fases = resumo?.fases ?? [];
  const proxima = fases.findIndex((f) => f.estado !== "feita");
  const href = (aba?: string) => `/emendas/${e.id}${aba ? `?aba=${aba}` : ""}`;

  const [aba, setAba] = React.useState<AbaPainel>("resumo");
  const [pacote, setPacote] = React.useState<PacoteDetalhe | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const carregando = React.useRef(false);

  const carregar = React.useCallback(async () => {
    if (carregando.current) return;
    carregando.current = true;
    setErro(null);
    const r = await carregarPacoteDetalhe(e.id);
    carregando.current = false;
    if (r.ok) setPacote(r.pacote);
    else setErro(r.erro);
  }, [e.id]);

  // A primeira aba que precisa dos dados completos dispara a leitura (a partir do clique, não de um efeito).
  const abrirAba = (destino: AbaPainel) => {
    setAba(destino);
    if (destino !== "resumo" && !pacote && !erro) void carregar();
  };

  const aoSucesso = React.useCallback(() => {
    void carregar();
    router.refresh(); // a lista e o resumo acompanham a gravação
  }, [carregar, router]);

  const abertas = resumo?.abertas ?? 0;
  const abas: [AbaPainel, string][] = [
    ["resumo", "Resumo"],
    ["fases", resumo && resumo.total > 0 ? `Fases ${resumo.concluidas}/${resumo.total}` : "Fases"],
    ["documentacao", "Documentação"],
    ["pendencias", abertas ? `Pendências (${abertas})` : "Pendências"],
    ["financeiro", "Financeiro"],
    ["andamentos", "Andamentos"],
    ["parceria", "Parceria"],
    ["historico", "Histórico"],
  ];
  const irParaAba = (destino: string) => {
    if (abas.some(([k]) => k === destino)) abrirAba(destino as AbaPainel);
    else if (destino === "execucao" || destino === "transparencia") abrirAba("parceria");
  };

  const atalhos = pacote?.processoCompras
    ? { processo: pacote.processoCompras.numero, licitacao: pacote.processoCompras.numero_licitacao, contrato: pacote.processoCompras.contratos[0]?.numero ?? pacote.processoCompras.contrato_vinculado }
    : undefined;
  const vinculo = pacote ? <VinculoCompras emendaId={e.id} processo={pacote.processoCompras} numeroLivre={pacote.detalhe.execucao?.processo_licitatorio ?? null} podeEditar={pacote.podeEditar} /> : null;

  const dados = (
    [
      ["Vereador(a)", `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`],
      ["Unidade", `${e.unidade_codigo} ${e.unidade_nome}`],
      ["Ficha", e.ficha],
      ["Natureza", e.natureza_despesa],
      ["Funcional", e.funcional_programatica],
    ] as [string, string | null][]
  ).filter(([, v]) => v);

  const blocoResumo = (
    <div className="emd-cont">
      <div className="emd-det-grade">
        <div className="space-y-4">
          <section aria-label="Execução financeira" className="space-y-2.5">
            <h3 className={CLASSE_TITULO}>Execução financeira</h3>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.8125rem] text-slate-600">Valor da emenda</span>
              <span className="text-[1.125rem] font-semibold leading-none tracking-tight tabular-nums text-cataguases-marinho">{brl(e.valor)}</span>
            </div>
            <Barra rotulo="Empenhado" valor={e.empenhado} total={e.valor} cor="#7C5CCF" detalhe={`${pct(e.valor ? e.empenhado / e.valor : 0, 0)} do valor da emenda`} />
            <Barra rotulo="Pago" valor={e.pago} total={e.empenhado || e.valor} cor="#4C3494" detalhe={e.empenhado ? `${pct(e.pago / e.empenhado, 0)} do empenhado` : "sem empenho ainda"} />
            <div className="grid grid-cols-2 gap-2 text-[0.8125rem]">
              <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="block text-xs text-slate-500">A pagar</span><span className="font-semibold tabular-nums text-cataguases-marinho">{brl(aPagar)}</span></div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><span className="block text-xs text-slate-500">Sem empenhar</span><span className="font-semibold tabular-nums text-cataguases-marinho">{brl(semEmpenhar)}</span></div>
            </div>
          </section>

          {!!resumo?.pendencias?.length && (
            <section aria-label="Pendências" className="space-y-2">
              <h3 className={cn(CLASSE_TITULO, "flex items-center justify-between")}>
                Pendências abertas
                <button type="button" onClick={() => abrirAba("pendencias")} className="font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] hover:underline">ver todas ({resumo.abertas})</button>
              </h3>
              <ul className="space-y-1">
                {resumo.pendencias.map((p, i) => (
                  <li key={`${p.titulo}-${i}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-[0.8125rem]">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: COR_GRAVIDADE[p.gravidade] }} aria-hidden />
                    <span className="min-w-0 flex-1 leading-snug text-cataguases-marinho">{p.titulo}</span>
                    <span className="flex-none text-xs font-medium" style={{ color: COR_GRAVIDADE[p.gravidade] }}>{NOME_GRAVIDADE[p.gravidade]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {fases.length > 0 && (
            <section aria-label="Fases" className="space-y-2">
              <h3 className={cn(CLASSE_TITULO, "flex items-center justify-between")}>
                Fluxo de fases
                <button type="button" onClick={() => abrirAba("fases")} className="font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] hover:underline">detalhar</button>
              </h3>
              <ol>
                {fases.map((f, i) => {
                  const atual = i === proxima;
                  return (
                    <li key={`${f.nome}-${i}`} className="relative flex items-center gap-2.5 py-[0.1875rem]">
                      {i < fases.length - 1 && <span aria-hidden className="absolute left-[0.5625rem] top-[1.4rem] h-[calc(100%-0.9rem)] w-px" style={{ background: f.estado === "feita" ? "#10B981" : "rgb(203 213 225)" }} />}
                      <span
                        className={cn(
                          "relative z-[1] flex h-[1.125rem] w-[1.125rem] flex-none items-center justify-center rounded-full border-2",
                          f.estado === "feita" && "border-emerald-500 bg-emerald-500 text-white",
                          f.estado === "parcial" && "border-amber-500 bg-white text-amber-600",
                          f.estado === "andamento" && "border-[color:var(--modulo)] bg-white",
                          f.estado === "pendente" && "border-slate-300 bg-white",
                          atual && "emd-pulso"
                        )}
                      >
                        {(f.estado === "feita" || f.estado === "parcial") && <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />}
                        {f.estado === "andamento" && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--modulo)" }} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-snug" title={f.nome}>
                        <span className={cn(f.estado === "pendente" && !atual ? "text-slate-500" : "font-medium text-cataguases-marinho")}>{f.nome}</span>
                        {atual && <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] px-1.5 py-px text-[0.6875rem] font-semibold text-[color:var(--modulo-tinta)]">próxima</span>}
                        {f.alerta && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Com alerta" />}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section aria-label="Dados" className="space-y-1.5">
            <h3 className={CLASSE_TITULO}>Dados</h3>
            <dl className="divide-y divide-slate-100 text-[0.8125rem]">
              {dados.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-2 py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="min-w-0 break-words font-medium text-cataguases-marinho">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {pacote?.detalhe.emenda.descricao && (
            <section aria-label="Descrição" className="space-y-1.5">
              <h3 className={CLASSE_TITULO}>Descrição completa</h3>
              <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-slate-700">{pacote.detalhe.emenda.descricao}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );

  const abaDoDetalhe: AbaEmenda | null = aba === "resumo" || aba === "parceria" ? null : aba;

  return (
    <article key={e.id} className="emd-troca flex h-full min-w-[20rem] flex-col" aria-label={`Emenda ${e.numero}`}>
      <header className="relative px-4 pb-2.5 pt-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 14%, transparent), transparent 70%)` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono font-semibold text-cataguases-marinho ring-1 ring-slate-200">Nº {e.numero}</span>
            <TipoSelo tipo={tipo} />
            <CategoriaSelo categoria={e.beneficiario_categoria} />
            {e.saude && <Chip tom="saude">Saúde</Chip>}
            {e.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhe da emenda" title="Fechar (Esc)" className="-mr-1.5 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-cataguases-marinho">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <h2 className="mt-2 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-cataguases-marinho" title={e.objeto}>{e.objeto}</h2>
        <p className="mt-0.5 truncate text-[0.8125rem] text-slate-600">{[e.beneficiario_nome, e.secretaria_nome].filter(Boolean).join(" · ")}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <SeloEtapa etapa={e.etapa} situacao={e.situacao} catalogo={catalogo} />
            {e.ultimo_pagamento && <span className="text-xs text-slate-500">pago em {dataBr(e.ultimo_pagamento)}</span>}
          </div>
          {resumo && resumo.total > 0 && (
            <div className="flex flex-none items-center gap-2" title={`${resumo.concluidas} de ${resumo.total} fases concluídas`}>
              <span className="text-right text-xs leading-tight text-slate-600">
                <span className="block font-medium text-cataguases-marinho">Andamento</span>
                <span className="block tabular-nums">{resumo.concluidas}/{resumo.total} fases</span>
              </span>
              <AnelAndamento concluidas={resumo.concluidas} total={resumo.total} tamanho={40} espessura={4.5} />
            </div>
          )}
        </div>
      </header>

      <div role="tablist" aria-label="Seções da emenda" className="flex flex-none gap-0.5 overflow-x-auto overscroll-x-contain border-y border-slate-200 bg-white/60 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onPointerEnter={() => { if (!pacote && !erro) void carregar(); }}>
        {abas.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            id={`aba-${e.id}-${chave}`}
            aria-selected={aba === chave}
            onClick={() => abrirAba(chave)}
            className={cn(
              "relative flex-none whitespace-nowrap px-2.5 py-2 text-[0.8125rem] transition-colors",
              aba === chave ? "font-semibold text-[color:var(--modulo-tinta)]" : "text-slate-600 hover:text-cataguases-marinho"
            )}
          >
            {rotulo}
            <span aria-hidden className={cn("absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity", aba === chave ? "opacity-100" : "opacity-0")} style={{ backgroundColor: "var(--modulo)" }} />
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5" role="tabpanel" aria-labelledby={`aba-${e.id}-${aba}`}>
        {erro && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {erro}{" "}
            <button type="button" className="font-medium underline" onClick={() => void carregar()}>Tentar de novo</button>
          </p>
        )}
        {aba === "resumo" && blocoResumo}
        {aba !== "resumo" && !pacote && !erro && <Esqueleto />}
        {pacote && (
          <>
            <DetalheEmendaCliente
              key={`${e.id}-${aba}`}
              modoPainel
              abaControlada={abaDoDetalhe}
              aoMudarAba={irParaAba}
              aoSucesso={aoSucesso}
              detalhe={pacote.detalhe}
              podeEditar={pacote.podeEditar}
              gestor={pacote.gestor}
              beneficiarios={pacote.beneficiarios}
              unidades={pacote.unidades}
              auditoria={pacote.auditoria}
              exclusoes={pacote.exclusoes}
              podeCorrigirLancamento={pacote.podeCorrigirLancamento}
              nomesUsuarios={pacote.nomesUsuarios}
              fases={pacote.fases}
              pendencias={pacote.pendencias}
              corTipo={cor}
              atalhos={atalhos}
              vinculo={tipo === "direta" ? vinculo : undefined}
            />
            {aba === "parceria" && (
              <div className="space-y-4">
                <PainelParceria emendaId={e.id} modalidade={tipo === "direta" ? "direta" : "repasse"} execucao={pacote.detalhe.execucao} podeEditar={pacote.podeEditar} permiteConvenio={tipo === "ente"} />
                <PainelTransparencia emendaId={e.id} execucao={pacote.detalhe.execucao} itens={pacote.conformidade} saude={e.saude} podeEditar={pacote.podeEditar} identificadorDaDotacao={identificadorDaFicha(e.ficha, e.natureza_despesa)} />
                {tipo !== "direta" && vinculo}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/70 px-4 py-2 backdrop-blur">
        <span className="text-xs text-slate-500">{pacote ? (pacote.podeEditar ? "Você pode registrar andamentos nesta emenda." : "Você só visualiza esta emenda.") : "Abas Fases a Histórico: mesmos dados da emenda completa."}</span>
        <Link href={href(abaDoDetalhe ?? undefined)} className="btn-ui inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color:var(--modulo-texto)] px-3 text-[0.8125rem] font-semibold text-white hover:brightness-110">
          Abrir emenda completa <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </footer>
    </article>
  );
}
