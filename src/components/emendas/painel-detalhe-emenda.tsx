"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Maximize2, Minimize2, Pencil, Plus, X } from "lucide-react";

import { CaixaInfo, CaixaLinhas, CaixaNota, CaixaTitulo } from "@/components/modulo/caixa-info";
import { corDoSegmento, macrosDoResumo } from "@/components/emendas/barra-fases";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { DetalheEmendaCliente, type AbaEmenda, type ControleDetalhe } from "@/components/emendas/detalhe-emenda";
import { PainelParceria } from "@/components/emendas/painel-parceria";
import { PainelTransparencia } from "@/components/emendas/painel-transparencia";
import { TipoSelo } from "@/components/emendas/tipo-selo";
import { Chip } from "@/components/emendas/ui";
import { VinculoCompras } from "@/components/emendas/vinculo-compras";
import { carregarPacoteDetalhe, type PacoteDetalhe } from "@/lib/emendas/actions-painel";
import { COR_DINHEIRO } from "@/lib/emendas/cores-financeiras";
import { identificadorDaFicha } from "@/lib/emendas/conformidade";
import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { alertasDaMacro, indiceDaProxima, NOME_CURTO_MACRO, proximoPasso } from "@/lib/emendas/fases-resumo";
import { NOME_GRAVIDADE } from "@/lib/emendas/pendencias";
import { brl, numeroVereador, pct } from "@/lib/emendas/regras";
import type { ResumoLinha } from "@/lib/emendas/resumo";
import { AbasComMais } from "@/components/modulo/abas-com-mais";
import { cn } from "@/lib/utils";
import type { EmendaResumo } from "@/types/emendas";

const COR_GRAVIDADE = { alta: "#B91C1C", media: "#B45309", baixa: "#64748B" } as const;
// Cores do dinheiro: as mesmas na barra do painel e na caixa de andamento da lista.
const COR_PAGO = COR_DINHEIRO.pago;
const COR_A_PAGAR = COR_DINHEIRO.aPagar;
const COR_SEM_EMPENHO = COR_DINHEIRO.semEmpenhar;

export type AbaPainel = "resumo" | "parceria" | Extract<AbaEmenda, "fases" | "documentacao" | "pendencias" | "financeiro" | "andamentos" | "historico">;

const CLASSE_TITULO = "text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-slate-600";
const CLASSE_BOTAO_PRIMARIO = "btn-ui inline-flex min-h-8 py-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[color:var(--modulo-texto)] px-3 text-[0.8125rem] font-semibold text-white hover:brightness-110 disabled:opacity-50";
/** Ação principal da aba, pequena, no canto do cabeçalho (não ocupa uma linha própria). */
const CLASSE_BOTAO_ACAO = "btn-ui mr-1 inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md bg-[color:var(--modulo-texto)] px-2.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50";
const CLASSE_BOTAO_SECUNDARIO = "btn-ui inline-flex min-h-8 py-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-[0.8125rem] font-semibold text-cataguases-marinho hover:bg-slate-50";

function Esqueleto() {
  return (
    <div className="animate-pulse space-y-3 motion-reduce:animate-none" role="status" aria-label="Carregando os detalhes da emenda">
      <div className="h-4 w-1/3 rounded bg-slate-200/70" />
      <div className="h-24 rounded-xl bg-slate-100" />
      <div className="h-4 w-1/4 rounded bg-slate-200/70" />
      <div className="h-32 rounded-xl bg-slate-100" />
    </div>
  );
}

/**
 * Painel à direita da lista: a emenda escolhida sem sair da lista. O Resumo usa só o que a lista já carregou e diz o próximo
 * passo; as demais abas (Financeiro, Fases, Documentos, Pendências e, em "Mais", Andamentos, Parceria e Histórico) são as mesmas
 * da página da emenda, carregadas logo depois de abrir o painel, e gravam pelas mesmas ações. Remanejamento e impedimento não
 * têm botão aqui (o remanejamento é feito em Configurações).
 */
export type AtualizacaoEmenda = { emenda: EmendaResumo; resumo: ResumoLinha };

export function PainelDetalheEmenda({
  emendaId,
  emenda,
  resumo,
  aoFechar,
  expandido,
  aoExpandir,
  abaInicial,
  aoAtualizar,
}: {
  emendaId: string;
  /** O que a tela de origem já tem da emenda (a lista); sem isso o painel espera a leitura completa. */
  emenda?: EmendaResumo;
  resumo?: ResumoLinha;
  aoFechar: () => void;
  expandido: boolean;
  aoExpandir: () => void;
  abaInicial?: AbaPainel;
  /** Chamado depois de uma gravação com a emenda já recalculada: a tela atualiza só essa linha na hora. */
  aoAtualizar?: (id: string, dados: AtualizacaoEmenda) => void;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = React.useTransition();
  const [pacote, setPacote] = React.useState<PacoteDetalhe | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const carregando = React.useRef(false);

  const carregar = React.useCallback(
    async (notificar = false) => {
      if (carregando.current) return;
      carregando.current = true;
      setErro(null);
      const r = await carregarPacoteDetalhe(emendaId);
      carregando.current = false;
      if (!r.ok) return setErro(r.erro);
      setPacote(r.pacote);
      if (notificar) aoAtualizar?.(emendaId, { emenda: r.pacote.detalhe.emenda, resumo: r.pacote.resumo });
    },
    [emendaId, aoAtualizar]
  );

  // Os dados completos vêm logo depois de a emenda abrir (com uma pausa, para quem navega pela lista com as setas; sem pausa
  // quando a tela de origem não tem nada da emenda para mostrar).
  React.useEffect(() => {
    const t = setTimeout(() => void carregar(), emenda ? 350 : 0);
    return () => clearTimeout(t);
  }, [carregar, emenda]);

  // Depois de gravar: a emenda recalculada aparece na hora (aqui e na linha da lista) e o restante da tela se revalida em segundo plano.
  const aoSucesso = React.useCallback(() => {
    void carregar(true);
    iniciarTransicao(() => router.refresh());
  }, [carregar, router]);

  const e = pacote?.detalhe.emenda ?? emenda;
  const res = pacote?.resumo ?? resumo;
  if (!e) {
    return (
      <article className="flex h-full min-w-[20rem] flex-col gap-4 p-4" aria-label="Carregando a emenda">
        <div className="flex justify-end">
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhe da emenda" title="Fechar (Esc)" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/70">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {erro ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {erro} <button type="button" className="font-medium underline" onClick={() => void carregar()}>Tentar de novo</button>
          </p>
        ) : (
          <Esqueleto />
        )}
      </article>
    );
  }
  return <PainelCorpo key={e.id} emenda={e} resumo={res} pacote={pacote} erro={erro} carregar={carregar} aoSucesso={aoSucesso} aoFechar={aoFechar} expandido={expandido} aoExpandir={aoExpandir} abaInicial={abaInicial} />;
}

function PainelCorpo({
  emenda: e,
  resumo,
  pacote,
  erro,
  carregar,
  aoSucesso,
  aoFechar,
  expandido,
  aoExpandir,
  abaInicial,
}: {
  emenda: EmendaResumo;
  resumo?: ResumoLinha;
  pacote: PacoteDetalhe | null;
  erro: string | null;
  carregar: () => Promise<void>;
  aoSucesso: () => void;
  aoFechar: () => void;
  expandido: boolean;
  aoExpandir: () => void;
  abaInicial?: AbaPainel;
}) {
  useCatalogo();
  const tipo = tipoDaEmenda(e);
  const cor = TIPOS_EXECUCAO[tipo].cor;
  const aPagar = Math.max(0, e.empenhado - e.pago);
  const semEmpenhar = Math.max(0, e.valor - e.empenhado);
  const macros = React.useMemo(() => macrosDoResumo(resumo), [resumo]);
  const iProxima = indiceDaProxima(macros);
  const passo = React.useMemo(() => proximoPasso(e, macros), [e, macros]);

  const [aba, setAba] = React.useState<AbaPainel>(abaInicial ?? "resumo");
  const [dadosAbertos, setDadosAbertos] = React.useState(false);
  const controle = React.useRef<ControleDetalhe>(null);

  const abrirAba = (destino: AbaPainel) => {
    setAba(destino);
    if (destino !== "resumo" && !pacote && !erro) void carregar();
  };
  const irParaAba = (destino: string) => {
    if (["resumo", "fases", "documentacao", "pendencias", "financeiro", "andamentos", "parceria", "historico"].includes(destino)) abrirAba(destino as AbaPainel);
    else if (destino === "execucao" || destino === "transparencia") abrirAba("parceria");
  };

  const abrirDialogo = React.useCallback<ControleDetalhe["abrir"]>((d, o) => controle.current?.abrir(d, o), []);
  const textoCompleto = e.descricao && e.descricao.trim().length > e.objeto.length ? e.descricao.trim() : e.objeto;
  const podeGravar = !!pacote && pacote.podeEditar && e.situacao !== "cancelada";
  const abertas = resumo?.abertas ?? 0;
  const abas: [AbaPainel, string][] = [
    ["resumo", "Resumo"],
    ["financeiro", "Financeiro"],
    ["fases", resumo && resumo.total > 0 ? `Fases ${resumo.concluidas}/${resumo.total}` : "Fases"],
    ["documentacao", "Documentos"],
    ["pendencias", abertas ? `Pendências (${abertas})` : "Pendências"],
    ["andamentos", "Andamentos"],
    ["parceria", "Parceria"],
    ["historico", "Histórico"],
  ];

  // Ação principal da aba aberta (uma só; o resto fica no menu "⋯").
  const primaria: "movimento" | "andamento" | null = aba === "financeiro" ? "movimento" : aba === "resumo" || aba === "fases" || aba === "andamentos" ? "andamento" : null;

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

  const executarPasso = () => {
    if (passo.acao === "andamento") abrirDialogo("andamento");
    else if (passo.acao === "empenho") abrirDialogo("movimento", { tipoMovimento: "empenho" });
    else if (passo.acao === "pagamento") abrirDialogo("movimento", { tipoMovimento: "pagamento" });
  };

  // Barra financeira: pago + a pagar = empenhado; o resto do valor ainda não foi empenhado.
  const baseBarra = Math.max(e.valor, e.empenhado, 1);
  const fatiaBarra = (v: number, c: string, nome: string) => (
    <span key={nome} className="emd-preenche block h-full" style={{ flex: `${v} 0 0`, minWidth: v > 0 ? 4 : 0, backgroundColor: c }} />
  );

  const blocoResumo = (
    <div className="space-y-4">
      <section aria-label="Próximo passo" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-[color-mix(in_srgb,var(--modulo)_9%,transparent)] px-4 py-3.5">
        <div className="min-w-[14rem] flex-1">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--modulo-tinta)]">Próximo passo</p>
          <p className="mt-0.5 text-[1.0625rem] font-semibold leading-snug tracking-tight text-cataguases-marinho">{passo.titulo}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-slate-700">{passo.texto}</p>
        </div>
        {((passo.acao && passo.acao !== "andamento" && (podeGravar || !pacote)) || passo.atalho) && (
          <div className="flex flex-none flex-col gap-2 max-sm:w-full max-sm:flex-row">
            {passo.acao && passo.acao !== "andamento" && (podeGravar || !pacote) && (
              <button type="button" disabled={!pacote} onClick={executarPasso} className={cn(CLASSE_BOTAO_PRIMARIO, "h-9")}>
                {passo.rotuloAcao}
              </button>
            )}
            {passo.atalho && (
              <button type="button" onClick={() => abrirAba(passo.atalho!.aba)} className={cn(CLASSE_BOTAO_SECUNDARIO, "h-9 border-[color:var(--modulo)]/40 text-[color:var(--modulo-tinta)]")}>
                {passo.atalho.rotulo}
              </button>
            )}
          </div>
        )}
      </section>

      {macros.length > 0 && (
        <section aria-label="Fluxo de fases" className="space-y-2.5">
          <h3 className={cn(CLASSE_TITULO, "flex flex-wrap items-baseline gap-x-3")}>
            Fluxo de fases
            {resumo && <span className="text-[0.8125rem] font-normal normal-case tracking-normal text-slate-600">{resumo.concluidas} de {resumo.total} fases concluídas</span>}
            <button type="button" onClick={() => abrirAba("fases")} className="ml-auto text-[0.8125rem] font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] hover:underline">detalhar</button>
          </h3>
          <ol className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${macros.length}, minmax(0, 1fr))` }}>
            {macros.map((m, i) => {
              const atual = i === iProxima;
              return (
                <CaixaInfo
                  key={m.chave}
                  as="li"
                  className="flex min-w-0 flex-col gap-1.5"
                  conteudo={
                    <>
                      <CaixaTitulo rotulo="Etapa do fluxo" valor={m.nome} />
                      <CaixaLinhas linhas={m.fases.map((f) => ({ rotulo: f.nome, valor: f.estado === "feita" ? "concluída" : f.estado === "pendente" ? "a fazer" : "em andamento", cor: f.estado === "feita" ? "#10B981" : f.estado === "pendente" ? "#CBD5E1" : "#6B4FBB" }))} />
                      {alertasDaMacro(m).length > 0 && (
                        <div className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[0.78125rem] leading-snug text-amber-900">
                          <p className="font-semibold">Atenção nesta etapa</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {alertasDaMacro(m).map((a) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <CaixaNota>O detalhe de cada fase (datas, documentos) está na aba Fases.</CaixaNota>
                    </>
                  }
                >
                  <span className={cn("block h-1.5 rounded-full", atual && "emd-pulso")} style={{ backgroundColor: corDoSegmento(m, atual) }} />
                  <span className={cn("text-[0.71875rem] leading-snug tracking-tight", m.estado === "pendente" && !atual ? "text-slate-600" : "font-medium text-cataguases-marinho")}>
                    {NOME_CURTO_MACRO[m.chave]}
                    {m.alerta && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label={`Com alerta: ${alertasDaMacro(m).join("; ")}`} />}
                  </span>
                  <span className="text-[0.75rem] text-slate-600">{m.estado === "feita" ? "concluída" : atual ? (m.estado === "andamento" ? "em andamento" : "próxima") : m.estado === "andamento" ? "em andamento" : "a fazer"}</span>
                </CaixaInfo>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-label="Execução financeira" className="space-y-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className={CLASSE_TITULO}>Execução financeira</h3>
          <span className="ml-auto text-[0.8125rem] text-slate-600">Valor da emenda</span>
          <span className="text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums text-cataguases-marinho">{brl(e.valor)}</span>
        </div>
        <CaixaInfo
          as="div"
          className="space-y-2.5"
          conteudo={
            <>
              <CaixaTitulo rotulo="Execução financeira" valor={brl(e.valor)} lado={e.valor ? pct(e.empenhado / e.valor, 0) : undefined} ladoApoio="empenhado" />
              <CaixaLinhas
                linhas={[
                  { rotulo: "Empenhado", valor: brl(e.empenhado), cor: COR_DINHEIRO.empenhado, apoio: e.valor ? pct(e.empenhado / e.valor, 0) : undefined },
                  { rotulo: "Pago", valor: brl(e.pago), cor: COR_PAGO, apoio: e.empenhado ? `${pct(e.pago / e.empenhado, 0)} do empenhado` : undefined },
                  { rotulo: "A pagar", valor: brl(aPagar), cor: COR_A_PAGAR },
                  { rotulo: "Sem empenhar", valor: brl(semEmpenhar), cor: COR_SEM_EMPENHO },
                ]}
              />
              <CaixaNota>Pago + a pagar = empenhado. O que não foi empenhado ainda não saiu do valor da emenda.</CaixaNota>
            </>
          }
        >
          <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Pago ${brl(e.pago)}, a pagar ${brl(aPagar)}, sem empenhar ${brl(semEmpenhar)}`}>
            {fatiaBarra(e.pago, COR_PAGO, "Pago")}
            {fatiaBarra(aPagar, COR_A_PAGAR, "A pagar")}
            {fatiaBarra(semEmpenhar, COR_SEM_EMPENHO, "Sem empenhar")}
            <span className="block h-full" style={{ flex: `${Math.max(0, baseBarra - e.pago - aPagar - semEmpenhar)} 0 0` }} />
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            <div>
              <dt className="text-[0.8125rem] text-slate-600">Empenhado</dt>
              <dd className="text-[0.9375rem] font-semibold tabular-nums text-cataguases-marinho">{brl(e.empenhado)}</dd>
            </div>
            {(
              [
                ["Pago", e.pago, COR_PAGO],
                ["A pagar", aPagar, COR_A_PAGAR],
                ["Sem empenhar", semEmpenhar, COR_SEM_EMPENHO],
              ] as [string, number, string][]
            ).map(([nome, v, c]) => (
              <div key={nome}>
                <dt className="flex items-center gap-1.5 text-[0.8125rem] text-slate-600"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: c }} aria-hidden />{nome}</dt>
                <dd className="text-[0.9375rem] font-semibold tabular-nums text-cataguases-marinho">{brl(v)}</dd>
              </div>
            ))}
          </dl>
        </CaixaInfo>
      </section>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        <section aria-label="Pendências" className="space-y-2 rounded-xl border border-slate-200 px-3.5 py-3">
          <h3 className={cn(CLASSE_TITULO, "flex items-center justify-between")}>
            Pendências abertas ({abertas})
            {abertas > 0 && <button type="button" onClick={() => abrirAba("pendencias")} className="text-[0.8125rem] font-medium normal-case tracking-normal text-[color:var(--modulo-tinta)] hover:underline">ver todas</button>}
          </h3>
          {resumo?.pendencias?.length ? (
            <ul className="space-y-1.5">
              {resumo.pendencias.map((p, i) => (
                <li key={`${p.titulo}-${i}`} className="flex items-start gap-2 text-[0.8125rem]">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: COR_GRAVIDADE[p.gravidade] }} aria-hidden />
                  <span className="min-w-0 flex-1 leading-snug text-cataguases-marinho">{p.titulo}</span>
                  <span className="flex-none text-[0.8125rem] font-medium" style={{ color: COR_GRAVIDADE[p.gravidade] }}>{NOME_GRAVIDADE[p.gravidade]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-[0.8125rem] text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />Nenhuma pendência aberta.</p>
          )}
        </section>
        <button type="button" aria-expanded={dadosAbertos} onClick={() => setDadosAbertos((v) => !v)} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left hover:bg-slate-50">
          <span className="min-w-0 flex-1">
            <span className="block text-[0.875rem] font-semibold text-cataguases-marinho">Dados orçamentários</span>
            <span className="block truncate text-[0.8125rem] text-slate-600">Unidade {e.unidade_codigo}{e.natureza_despesa ? ` · natureza ${e.natureza_despesa}` : ""}</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 flex-none text-slate-600 transition-transform", dadosAbertos && "rotate-180")} aria-hidden />
        </button>
      </div>

      {dadosAbertos && (
        <section aria-label="Dados" className="space-y-3">
          <dl className="divide-y divide-slate-100 text-[0.8125rem]">
            {dados.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6rem_1fr] gap-2 py-1.5">
                <dt className="text-slate-600">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-cataguases-marinho">{v}</dd>
              </div>
            ))}
          </dl>
          {pacote?.detalhe.emenda.descricao && (
            <div className="space-y-1">
              <h3 className={CLASSE_TITULO}>Descrição completa</h3>
              <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-slate-700">{pacote.detalhe.emenda.descricao}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );

  const abaDoDetalhe: AbaEmenda | null = aba === "resumo" || aba === "parceria" ? null : aba;

  return (
    <article key={e.id} className="emd-troca flex h-full min-w-[20rem] flex-col" aria-label={`Emenda ${e.numero}`}>
      <header className="relative px-4 pb-2 pt-2.5" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${cor} 14%, transparent), transparent 70%)` }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-white/70 px-2 py-0.5 font-mono font-semibold text-cataguases-marinho ring-1 ring-slate-200">Nº {e.numero}</span>
            <TipoSelo tipo={tipo} />
            <CategoriaSelo categoria={e.beneficiario_categoria} />
            {e.saude && <Chip tom="saude">Saúde</Chip>}
            {e.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
          </div>
          <div className="-mr-1.5 flex flex-none items-center gap-0.5">
            {primaria && !pacote && !erro && <span className="mr-1 h-7 w-24 animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none" aria-hidden />}
            {primaria && podeGravar && (
              <button type="button" onClick={() => abrirDialogo(primaria)} title={primaria === "movimento" ? "Lançar movimento" : "Registrar andamento"} aria-label={primaria === "movimento" ? "Lançar movimento" : "Registrar andamento"} className={CLASSE_BOTAO_ACAO}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {primaria === "movimento" ? "Movimento" : "Andamento"}
              </button>
            )}
            {pacote?.gestor && (
              <Link href={`/emendas/${e.id}/editar`} className="inline-flex min-h-8 py-1 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-medium text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-cataguases-marinho">
                <Pencil className="h-4 w-4" aria-hidden />
                Corrigir cadastro
              </Link>
            )}
            <button type="button" onClick={aoExpandir} aria-pressed={expandido} title={expandido ? "Voltar à lista (Esc)" : "Expandir o painel"} className="inline-flex max-lg:hidden min-h-8 py-1 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-medium text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-cataguases-marinho">
              {expandido ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
              {expandido ? "Recolher" : "Expandir"}
            </button>
            <button type="button" onClick={aoFechar} aria-label="Fechar detalhe da emenda" title="Fechar (Esc)" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-cataguases-marinho">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <CaixaInfo
          as="div"
          largura={380}
          conteudo={
            <>
              <CaixaTitulo rotulo={`Emenda nº ${e.numero}`} />
              {/* O objeto da lista é um resumo cortado; com o pacote carregado a caixa mostra o texto completo (descrição), que é o motivo de abri-la. */}
              <p className="mt-1 max-h-[16rem] overflow-hidden whitespace-pre-line text-[0.8125rem] leading-snug text-cataguases-marinho">{textoCompleto}</p>
              <dl className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5 text-[0.8125rem]">
                {[
                  ["Beneficiário", e.beneficiario_nome],
                  ["Secretaria", e.secretaria_nome],
                  ["Vereador(a)", `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{k}</dt>
                      <dd className="font-medium leading-snug text-cataguases-marinho">{v}</dd>
                    </div>
                  ))}
              </dl>
            </>
          }
        >
          <h2 className="mt-1.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-cataguases-marinho">{e.objeto}</h2>
        </CaixaInfo>
        <p className="mt-0.5 truncate text-[0.8125rem] text-slate-600" title={[e.beneficiario_nome, e.secretaria_nome, e.vereador_nome].filter(Boolean).join(" · ")}>
          {[e.beneficiario_nome, e.secretaria_nome, `Vereador(a) ${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`].filter(Boolean).join(" · ")}
        </p>
      </header>

      <AbasComMais abas={abas.map(([chave, rotulo]) => ({ chave, rotulo }))} ativa={aba} aoEscolher={abrirAba} idAba={(chave) => `aba-${e.id}-${chave}`} rotuloAria="Seções da emenda" />

      <div className="emd-rola min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5" role="tabpanel" aria-labelledby={`aba-${e.id}-${aba}`}>
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
              controleRef={controle}
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
    </article>
  );
}
