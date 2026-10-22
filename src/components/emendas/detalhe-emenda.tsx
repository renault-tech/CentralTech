"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, FileUp, Paperclip, Pencil, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  corrigirMovimento,
  definirCancelamento,
  linkDocumento,
  registrarAndamento,
  registrarDocumento,
  registrarImpedimento,
  registrarMovimento,
  remanejarEmenda,
  removerDocumento,
  resolverImpedimento,
  type Resultado,
} from "@/lib/emendas/actions";
import { useCatalogo } from "@/components/emendas/catalogo-etapas";
import { NOME_MODALIDADE, brl, dataBr, infoEtapa, modalidadePorNatureza, proximasEtapas, trilha } from "@/lib/emendas/regras";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { DetalheEmenda } from "@/lib/emendas/dados";
import type { Beneficiario, EtapaEmenda, TipoDocumento, UnidadeOrcamentaria } from "@/types/emendas";

export const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
export const BOTAO_PRIMARIO =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#6B4FBB] px-4 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";
export const BOTAO_SECUNDARIO =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50";

const TIPOS_DOC: { valor: TipoDocumento; rotulo: string; modalidade?: "repasse" | "direta" }[] = [
  { valor: "plano_trabalho", rotulo: "Plano de trabalho da entidade", modalidade: "repasse" },
  { valor: "certidoes", rotulo: "Certidões e regularidade da entidade", modalidade: "repasse" },
  { valor: "termo", rotulo: "Termo de fomento / colaboração", modalidade: "repasse" },
  { valor: "pedido", rotulo: "Pedido / termo de referência", modalidade: "direta" },
  { valor: "processo_compra", rotulo: "Processo de compra", modalidade: "direta" },
  { valor: "nota_empenho", rotulo: "Nota de empenho" },
  { valor: "nota_fiscal", rotulo: "Nota fiscal / liquidação" },
  { valor: "comprovante_pagamento", rotulo: "Comprovante de pagamento" },
  { valor: "prestacao_contas", rotulo: "Prestação de contas da entidade", modalidade: "repasse" },
  { valor: "outro", rotulo: "Outro documento" },
];

const ROTULO_CAMPO: Record<string, string> = {
  objeto: "Objeto",
  descricao: "Descrição",
  valor: "Valor",
  beneficiario: "Beneficiário",
  beneficiario_id: "Beneficiário",
  unidade: "Unidade orçamentária",
  unidade_id: "Unidade orçamentária",
  saude: "Saúde",
  funcional_programatica: "Funcional programática",
  natureza_despesa: "Natureza da despesa",
  dotacao_texto: "Dotação",
  ficha: "Nova dotação (ficha)",
  etapa: "Etapa",
  situacao: "Situação",
  modalidade: "Modalidade",
  vereador_id: "Vereador",
  numero: "Número",
  numero_vereador: "ID do vereador",
  numero_termo: "Termo de parceria",
  processo_licitatorio: "Processo licitatório",
  data_envio_pagamento: "Envio para pagamento",
  vigencia_inicio: "Início da vigência",
  vigencia_fim: "Fim da vigência",
  data_publicacao_extrato: "Publicação do extrato",
  conta_bancaria: "Conta bancária",
  gestor_osc: "Gestor na entidade",
  gestor_pmc: "Gestor na Prefeitura",
  observacao: "Observação",
};

const NOME_TIPO_MOV = { empenho: "Empenho", liquidacao: "Liquidação", pagamento: "Pagamento", anulacao: "Anulação de empenho" } as const;
const NOME_IMPEDIMENTO = { tecnico: "Técnico", legal: "Legal", documentacao: "Documentação da entidade" } as const;

function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function paraNumero(t: string): number | null {
  const limpo = t.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

type Aba = "andamentos" | "financeiro" | "documentos" | "historico";

export function DetalheEmendaCliente({
  detalhe,
  podeEditar,
  gestor,
  beneficiarios,
  unidades,
  auditoria,
  nomesUsuarios,
}: {
  detalhe: DetalheEmenda;
  podeEditar: boolean;
  gestor: boolean;
  beneficiarios: Beneficiario[];
  unidades: UnidadeOrcamentaria[];
  auditoria: { id: number; tabela: string; acao: string; em: string; usuario_id: string | null; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }[];
  nomesUsuarios: Record<string, string>;
}) {
  const catalogo = useCatalogo();
  const router = useRouter();
  const { emenda, andamentos, movimentos, impedimentos, remanejamentos, documentos } = detalhe;
  const [aba, setAba] = React.useState<Aba>("andamentos");
  const [dialogo, setDialogo] = React.useState<null | "andamento" | "impedimento" | "remanejar" | "movimento">(null);
  const [erroGeral, setErroGeral] = React.useState<string | null>(null);

  const abertos = impedimentos.filter((i) => !i.resolvido_em);
  const nomeBenef = (id: unknown) => beneficiarios.find((b) => b.id === id)?.nome ?? String(id ?? "—");
  const nomeUnidade = (id: unknown) => {
    const u = unidades.find((x) => x.id === id);
    return u ? `${u.codigo} - ${u.nome}` : String(id ?? "—");
  };
  const exibir = (campo: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (campo === "beneficiario_id") return nomeBenef(v);
    if (campo === "unidade_id") return nomeUnidade(v);
    if (campo === "valor") return brl(Number(v));
    if (campo === "saude") return v ? "Sim" : "Não";
    if (campo === "etapa") return infoEtapa(String(v), catalogo).nome;
    return String(v);
  };

  async function executar(acao: () => Promise<Resultado>) {
    setErroGeral(null);
    const r = await acao();
    if (!r.sucesso) setErroGeral(r.erro);
    else router.refresh();
    return r;
  }

  return (
    <>
      {(podeEditar || gestor) && (
        <div className="flex flex-wrap justify-end gap-2 print:hidden" data-tour="acoes-emenda">
          {podeEditar && emenda.situacao !== "cancelada" && (
            <>
              <button type="button" className={cn(BOTAO_SECUNDARIO, "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100")} onClick={() => setDialogo("impedimento")}>
                <AlertTriangle className="h-4 w-4" aria-hidden /> Registrar impedimento
              </button>
              <button type="button" className={BOTAO_PRIMARIO} onClick={() => setDialogo("andamento")}>
                + Registrar andamento
              </button>
            </>
          )}
          {gestor && emenda.situacao !== "cancelada" && (
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setDialogo("remanejar")}>
              Remanejar
            </button>
          )}
          {gestor && (
            <a href={`/emendas/${emenda.id}/editar`} className={BOTAO_SECUNDARIO}>
              <Pencil className="h-4 w-4" aria-hidden /> Corrigir cadastro
            </a>
          )}
        </div>
      )}

      {erroGeral && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{erroGeral}</p>}

      {abertos.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden /> Emenda impedida
          </p>
          {abertos.map((i) => (
            <ResolverImpedimento key={i.id} impedimento={i} podeEditar={podeEditar} nomeTipo={NOME_IMPEDIMENTO[i.tipo]} aoResolver={(resolucao) => executar(() => resolverImpedimento({ id: i.id, emendaId: emenda.id, resolucao }))} />
          ))}
          {gestor && <p className="mt-2 text-xs text-amber-900">Para destravar, remaneje a emenda (outra destinação/dotação) ou registre a resolução.</p>}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white print:border-0">
        <div role="tablist" aria-label="Seções da emenda" className="flex flex-wrap gap-1 border-b border-slate-200 px-3 print:hidden">
          {(
            [
              ["andamentos", `Andamentos (${andamentos.length})`],
              ["financeiro", "Financeiro"],
              ["documentos", `Documentos (${documentos.length})`],
              ["historico", `Histórico${remanejamentos.length ? ` (${remanejamentos.length})` : ""}`],
            ] as [Aba, string][]
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={aba === chave}
              onClick={() => setAba(chave)}
              className={cn(
                "border-b-2 px-3 py-3.5 text-sm transition-colors",
                aba === chave ? "border-[#6B4FBB] font-semibold text-cataguases-marinho" : "border-transparent text-slate-600 hover:text-cataguases-marinho"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="p-5">
          {aba === "andamentos" && (
            <ol className="flex flex-col">
              {andamentos.length === 0 && <li className="text-sm text-slate-500">Nenhum andamento registrado ainda — a emenda está como indicada na LOA.</li>}
              {andamentos.map((a, i) => (
                <li key={a.id} className="grid grid-cols-[92px_20px_1fr] gap-3">
                  <span className="pt-0.5 text-xs tabular-nums text-slate-600">{dataBr(a.data)}</span>
                  <span className="flex flex-col items-center" aria-hidden>
                    <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: infoEtapa(a.etapa, catalogo).cor === "#CBD5E1" ? "#94A3B8" : infoEtapa(a.etapa, catalogo).cor }} />
                    {i < andamentos.length - 1 && <span className="min-h-7 w-0.5 flex-1 bg-slate-200" />}
                  </span>
                  <div className="pb-5">
                    <strong className="text-sm text-cataguases-marinho">{infoEtapa(a.etapa, catalogo).nome}</strong>
                    {a.documento && <span className="ml-2 font-mono text-xs text-slate-600">{a.documento}</span>}
                    {a.observacao && <p className="mt-0.5 text-[13px] text-slate-600">{a.observacao}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {a.usuario_nome ? `Registrado por ${a.usuario_nome}` : "Registro do sistema"} em {new Date(a.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {aba === "financeiro" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                {[
                  ["Valor da emenda", emenda.valor],
                  ["Empenhado", emenda.empenhado],
                  ["Liquidado", emenda.liquidado],
                  ["Pago", emenda.pago],
                  ["Saldo a pagar", emenda.valor - emenda.pago],
                ].map(([rotulo, v]) => (
                  <div key={rotulo as string} className="rounded-lg border border-slate-200 p-3">
                    <span className="text-xs text-slate-600">{rotulo}</span>
                    <div className="mt-1 text-lg font-semibold tabular-nums text-cataguases-marinho">{brl(v as number)}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-600">
                      <th scope="col" className="px-3 py-2 font-medium">Movimento</th>
                      <th scope="col" className="px-3 py-2 font-medium">Documento</th>
                      <th scope="col" className="px-3 py-2 font-medium">Data</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Valor</th>
                      {gestor && <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Corrigir</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((m) => (
                      <LinhaMovimento
                        key={m.id}
                        movimento={m}
                        gestor={gestor}
                        nome={NOME_TIPO_MOV[m.tipo]}
                        aoCorrigir={(numero, data) => executar(() => corrigirMovimento({ id: m.id, emendaId: emenda.id, numero, data }))}
                      />
                    ))}
                  </tbody>
                </table>
                {movimentos.length === 0 && <p className="py-4 text-sm text-slate-500">Nenhum empenho, liquidação ou pagamento registrado ainda.</p>}
              </div>
              {podeEditar && (
                <div>
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setDialogo("movimento")}>
                    + Lançar movimento (parcial, anulação…)
                  </button>
                </div>
              )}
            </div>
          )}

          {aba === "documentos" && (
            <Documentos emendaId={emenda.id} modalidade={emenda.modalidade} documentos={documentos} podeEditar={podeEditar} gestor={gestor} executar={executar} />
          )}

          {aba === "historico" && (
            <div className="flex flex-col gap-3">
              {remanejamentos.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm text-cataguases-marinho">Remanejamento</strong>
                    <span className="text-xs text-slate-600">
                      {dataBr(r.data)}
                      {r.ato ? ` · ${r.ato}` : ""}
                    </span>
                  </div>
                  {r.motivo && <p className="mt-1 text-[13px] text-slate-600">{r.motivo}</p>}
                  {Object.keys(r.antes).map((campo) => (
                    <div key={campo} className="mt-2.5 grid gap-2 text-[13px] sm:grid-cols-[150px_1fr_1fr]">
                      <span className="text-slate-600">{ROTULO_CAMPO[campo] ?? campo}</span>
                      <span className="rounded-md bg-red-50 px-2 py-1.5 text-red-900 line-through decoration-red-300">{exibir(campo, r.antes[campo])}</span>
                      <span className="rounded-md bg-green-50 px-2 py-1.5 text-green-900">{exibir(campo, r.depois[campo])}</span>
                    </div>
                  ))}
                </div>
              ))}
              {impedimentos.filter((i) => i.resolvido_em).map((i) => (
                <div key={i.id} className="rounded-lg border border-slate-200 p-4 text-[13px]">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-sm text-cataguases-marinho">Impedimento {NOME_IMPEDIMENTO[i.tipo].toLowerCase()} (resolvido)</strong>
                    <span className="text-xs text-slate-600">
                      {dataBr(i.data)} → {dataBr(i.resolvido_em)}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{i.justificativa}</p>
                  {i.resolucao && <p className="mt-1 text-green-800">Resolução: {i.resolucao}</p>}
                </div>
              ))}
              {gestor && auditoria.length > 0 && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <strong className="text-sm text-cataguases-marinho">Registro de alterações do cadastro</strong>
                  <ul className="mt-2 flex flex-col gap-2 text-[13px]">
                    {auditoria.map((a) => {
                      const mudou = a.acao === "UPDATE" && a.antes && a.depois
                        ? Object.keys(a.depois).filter(
                            (k) => !["atualizado_em", "atualizado_por", "etapa_atualizada_em"].includes(k) && JSON.stringify(a.antes?.[k]) !== JSON.stringify(a.depois?.[k])
                          )
                        : [];
                      if (a.acao === "UPDATE" && mudou.length === 0) return null;
                      return (
                        <li key={a.id} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                          <span className="text-xs text-slate-500">
                            {new Date(a.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                            {(a.usuario_id && nomesUsuarios[a.usuario_id]) || "sistema"}
                          </span>
                          <div>
                            {a.acao === "INSERT"
                              ? a.tabela === "execucao" ? "Dados de parceria/execução registrados" : "Emenda cadastrada"
                              : a.acao === "DELETE"
                                ? a.tabela === "execucao" ? "Dados de parceria/execução apagados" : "Emenda apagada"
                                : mudou.map((k) => (
                                    <span key={k} className="mr-3 inline-block">
                                      {ROTULO_CAMPO[k] ?? k}: <span className="text-slate-500 line-through">{exibir(k, a.antes?.[k])}</span> →{" "}
                                      <span className="font-medium">{exibir(k, a.depois?.[k])}</span>
                                    </span>
                                  ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {remanejamentos.length === 0 && impedimentos.every((i) => !i.resolvido_em) && (!gestor || auditoria.length === 0) && (
                <p className="text-sm text-slate-500">Sem remanejamentos ou impedimentos resolvidos.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {gestor && (
        <div className="flex justify-end print:hidden">
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-red-700 hover:underline"
            onClick={() => {
              const cancelar = emenda.situacao !== "cancelada";
              if (cancelar && !window.confirm("Cancelar esta emenda? O valor deixa de contar na cota do vereador.")) return;
              void executar(() => definirCancelamento(emenda.id, cancelar));
            }}
          >
            {emenda.situacao === "cancelada" ? "Reativar emenda" : "Cancelar emenda"}
          </button>
        </div>
      )}

      {dialogo === "andamento" && (
      <DialogoAndamento
        aberto
        aoFechar={() => setDialogo(null)}
        emenda={emenda}
        aoSalvar={(d) => executar(() => registrarAndamento({ emendaId: emenda.id, ...d }))}
      />
      )}
      <DialogoImpedimento
        aberto={dialogo === "impedimento"}
        aoFechar={() => setDialogo(null)}
        aoSalvar={(d) => executar(() => registrarImpedimento({ emendaId: emenda.id, ...d }))}
      />
      <DialogoMovimento
        aberto={dialogo === "movimento"}
        aoFechar={() => setDialogo(null)}
        aoSalvar={(d) => executar(() => registrarMovimento({ emendaId: emenda.id, ...d }))}
      />
      {gestor && (
        <DialogoRemanejar
          aberto={dialogo === "remanejar"}
          aoFechar={() => setDialogo(null)}
          emenda={emenda}
          beneficiarios={beneficiarios}
          unidades={unidades}
          aoSalvar={(d) => executar(() => remanejarEmenda({ emendaId: emenda.id, ...d }))}
        />
      )}
    </>
  );
}

// -------------------------------------------------------------- peças

function useEnvio() {
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  async function enviar(fn: () => Promise<Resultado>, aoTerminar: () => void) {
    setEnviando(true);
    setErro(null);
    const r = await fn();
    setEnviando(false);
    if (r.sucesso) aoTerminar();
    else setErro(r.erro);
  }
  return { enviando, erro, setErro, enviar };
}

function Campo({ rotulo, children, dica }: { rotulo: string; children: React.ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cataguases-marinho">
      {rotulo}
      {children}
      {dica && <span className="text-xs font-normal text-slate-500">{dica}</span>}
    </label>
  );
}

function DialogoAndamento({
  aberto,
  aoFechar,
  emenda,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  emenda: DetalheEmenda["emenda"];
  aoSalvar: (d: { etapa: EtapaEmenda & Exclude<EtapaEmenda, "indicada">; data: string; documento?: string; observacao?: string; valor?: number | null }) => Promise<Resultado>;
}) {
  const catalogo = useCatalogo();
  const t = trilha(emenda.modalidade, catalogo).filter((e) => e !== "indicada") as Exclude<EtapaEmenda, "indicada">[];
  const sugerida = proximasEtapas(emenda.modalidade, emenda.etapa, catalogo)[0] ?? t[t.length - 1] ?? t[0];
  const valorSugerido = (k: string) => {
    const base = k === "empenhada" ? emenda.empenhado : k === "liquidada" ? emenda.liquidado : emenda.pago;
    const restante = Math.max(0, (k === "empenhada" ? emenda.valor : emenda.empenhado || emenda.valor) - base);
    return restante ? restante.toFixed(2).replace(".", ",") : "";
  };
  // Estado inicial a cada abertura: o pai só monta este diálogo quando ele
  // abre (sem efeitos para "resetar" o formulário).
  const [etapa, setEtapa] = React.useState<Exclude<EtapaEmenda, "indicada">>(sugerida);
  const [data, setData] = React.useState(hojeLocal());
  const [documento, setDocumento] = React.useState("");
  const [valor, setValor] = React.useState(valorSugerido(sugerida));
  const [observacao, setObservacao] = React.useState("");
  const { enviando, erro, enviar } = useEnvio();

  const financeira = etapa === "empenhada" || etapa === "liquidada" || etapa === "paga";

  const rotuloDoc =
    etapa === "empenhada" ? "Nº do empenho" : etapa === "liquidada" ? "Nº da liquidação / nota fiscal" : etapa === "paga" ? "Nº da ordem de pagamento" : etapa === "plano_trabalho" ? "Termo / protocolo" : etapa === "processo_compra" ? "Nº do processo (Compras)" : "Documento de referência";

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar andamento</DialogTitle>
          <DialogDescription>Emenda nº {emenda.numero} · {emenda.objeto}</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(
              () => aoSalvar({ etapa, data, documento, observacao, valor: financeira ? paraNumero(valor) : null }),
              aoFechar
            );
          }}
        >
          <Campo rotulo="Nova etapa">
            <select
              className={CAMPO}
              value={etapa}
              onChange={(e) => {
                setEtapa(e.target.value as typeof etapa);
                setValor(valorSugerido(e.target.value));
              }}
            >
              {t.map((k) => (
                <option key={k} value={k}>
                  {infoEtapa(k, catalogo).nome}
                  {k === emenda.etapa ? " (atual)" : ""}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Data">
              <input type="date" required className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo rotulo={rotuloDoc}>
              <input className={CAMPO} value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={100} />
            </Campo>
          </div>
          {financeira && (
            <Campo rotulo="Valor desta etapa (R$)" dica="Lança o movimento financeiro junto. Deixe em branco para só registrar a etapa.">
              <input inputMode="decimal" className={CAMPO} value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
          )}
          <Campo rotulo="Observação">
            <textarea rows={3} className={CAMPO} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={4000} />
          </Campo>
          {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>{enviando ? "Salvando…" : "Salvar andamento"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoImpedimento({ aberto, aoFechar, aoSalvar }: { aberto: boolean; aoFechar: () => void; aoSalvar: (d: { tipo: "tecnico" | "legal" | "documentacao"; justificativa: string; data: string }) => Promise<Resultado> }) {
  const [tipo, setTipo] = React.useState<"tecnico" | "legal" | "documentacao">("tecnico");
  const [data, setData] = React.useState(hojeLocal());
  const [justificativa, setJustificativa] = React.useState("");
  const { enviando, erro, enviar } = useEnvio();
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar impedimento</DialogTitle>
          <DialogDescription>A emenda fica marcada como impedida até ser resolvida ou remanejada.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(() => aoSalvar({ tipo, justificativa, data }), () => {
              setJustificativa("");
              aoFechar();
            });
          }}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Tipo">
              <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                <option value="tecnico">Técnico</option>
                <option value="legal">Legal</option>
                <option value="documentacao">Documentação da entidade</option>
              </select>
            </Campo>
            <Campo rotulo="Data">
              <input type="date" required className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
          <Campo rotulo="Justificativa (obrigatória)">
            <textarea rows={4} required minLength={10} className={CAMPO} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </Campo>
          {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar}>Cancelar</button>
            <button type="submit" className={cn(BOTAO_PRIMARIO, "bg-amber-700 hover:bg-amber-800")} disabled={enviando}>{enviando ? "Salvando…" : "Registrar impedimento"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoMovimento({
  aberto,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (d: { tipo: "empenho" | "liquidacao" | "pagamento" | "anulacao"; numero?: string; data: string | null; valor: number }) => Promise<Resultado>;
}) {
  const [tipo, setTipo] = React.useState<"empenho" | "liquidacao" | "pagamento" | "anulacao">("pagamento");
  const [numero, setNumero] = React.useState("");
  const [data, setData] = React.useState(hojeLocal());
  const [valor, setValor] = React.useState("");
  const { enviando, erro, setErro, enviar } = useEnvio();
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar movimento financeiro</DialogTitle>
          <DialogDescription>Para pagamentos parciais, anulações ou complementos. O sistema não deixa o pago passar do empenhado.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = paraNumero(valor);
            if (!v) return setErro("Informe o valor.");
            void enviar(() => aoSalvar({ tipo, numero, data, valor: v }), () => {
              setValor("");
              setNumero("");
              aoFechar();
            });
          }}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Tipo">
              <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
                {Object.entries(NOME_TIPO_MOV).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Nº do documento">
              <input className={CAMPO} value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={40} />
            </Campo>
            <Campo rotulo="Data">
              <input type="date" required className={CAMPO} value={data ?? ""} onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo rotulo="Valor (R$)">
              <input inputMode="decimal" required className={CAMPO} value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
          </div>
          {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>{enviando ? "Salvando…" : "Lançar"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoRemanejar({
  aberto,
  aoFechar,
  emenda,
  beneficiarios,
  unidades,
  aoSalvar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  emenda: DetalheEmenda["emenda"];
  beneficiarios: Beneficiario[];
  unidades: UnidadeOrcamentaria[];
  aoSalvar: (d: { ato?: string; motivo: string; novo: Record<string, unknown> }) => Promise<Resultado>;
}) {
  const [benef, setBenef] = React.useState(emenda.beneficiario_id ?? "");
  const [benefNovo, setBenefNovo] = React.useState("");
  const [unidade, setUnidade] = React.useState(emenda.unidade_id);
  const [natureza, setNatureza] = React.useState(emenda.natureza_despesa ?? "");
  const [funcional, setFuncional] = React.useState(emenda.funcional_programatica ?? "");
  const [ficha, setFicha] = React.useState(emenda.ficha ?? "");
  const [objeto, setObjeto] = React.useState(emenda.objeto);
  const [saude, setSaude] = React.useState(emenda.saude);
  const [ato, setAto] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const { enviando, erro, enviar } = useEnvio();
  const novaModalidade = modalidadePorNatureza(natureza);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Remanejar emenda nº {emenda.numero}</DialogTitle>
          <DialogDescription>
            Muda a destinação/dotação mantendo o valor e o vereador. O antes e depois ficam no histórico; impedimentos abertos são resolvidos.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            const novo: Record<string, unknown> = {};
            if (benef === "__novo") novo.beneficiarioNovo = benefNovo;
            else if (benef !== (emenda.beneficiario_id ?? "")) novo.beneficiario_id = benef || null;
            if (unidade !== emenda.unidade_id) novo.unidade_id = unidade;
            if (natureza && natureza !== emenda.natureza_despesa) novo.natureza_despesa = natureza;
            if (funcional && funcional !== emenda.funcional_programatica) novo.funcional_programatica = funcional;
            if (ficha && ficha !== emenda.ficha) novo.ficha = ficha;
            if (objeto !== emenda.objeto) novo.objeto = objeto;
            if (saude !== emenda.saude) novo.saude = saude;
            void enviar(() => aoSalvar({ ato, motivo, novo }), aoFechar);
          }}
        >
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Beneficiário / destinação">
              <select className={CAMPO} value={benef} onChange={(e) => setBenef(e.target.value)}>
                <option value="">— sem beneficiário —</option>
                {beneficiarios.map((b) => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
                <option value="__novo">+ Novo beneficiário…</option>
              </select>
            </Campo>
            {benef === "__novo" ? (
              <Campo rotulo="Nome do novo beneficiário">
                <input className={CAMPO} required value={benefNovo} onChange={(e) => setBenefNovo(e.target.value)} />
              </Campo>
            ) : (
              <Campo rotulo="Unidade orçamentária">
                <select className={CAMPO} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>{u.codigo} - {u.nome}</option>
                  ))}
                </select>
              </Campo>
            )}
            {benef === "__novo" && (
              <Campo rotulo="Unidade orçamentária">
                <select className={CAMPO} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>{u.codigo} - {u.nome}</option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo rotulo="Funcional programática">
              <input className={CAMPO} value={funcional} onChange={(e) => setFuncional(e.target.value)} placeholder="10.122.0010.2073" />
            </Campo>
            <Campo rotulo="Natureza da despesa" dica={novaModalidade ? `Modalidade: ${NOME_MODALIDADE[novaModalidade]}` : undefined}>
              <input className={CAMPO} value={natureza} onChange={(e) => setNatureza(e.target.value)} placeholder="3.3.90.30" />
            </Campo>
          </div>
          <Campo rotulo="Nova dotação (ficha)">
            <input className={CAMPO} value={ficha} onChange={(e) => setFicha(e.target.value)} />
          </Campo>
          <Campo rotulo="Objeto (resumo)">
            <input className={CAMPO} value={objeto} onChange={(e) => setObjeto(e.target.value)} />
          </Campo>
          <label className="flex items-center gap-2 text-[13px] text-cataguases-marinho">
            <input type="checkbox" checked={saude} onChange={(e) => setSaude(e.target.checked)} className="h-4 w-4 accent-[#6B4FBB]" /> Conta para a Saúde
          </label>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Campo rotulo="Ato / ofício">
              <input className={CAMPO} value={ato} onChange={(e) => setAto(e.target.value)} placeholder="Ofício nº…" />
            </Campo>
            <Campo rotulo="Motivo (obrigatório)">
              <input className={CAMPO} required minLength={5} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
          </div>
          {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={aoFechar}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>{enviando ? "Salvando…" : "Remanejar"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResolverImpedimento({
  impedimento,
  podeEditar,
  nomeTipo,
  aoResolver,
}: {
  impedimento: DetalheEmenda["impedimentos"][number];
  podeEditar: boolean;
  nomeTipo: string;
  aoResolver: (resolucao: string) => Promise<Resultado>;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [texto, setTexto] = React.useState("");
  const { enviando, erro, enviar } = useEnvio();
  return (
    <div className="mt-2 text-[13px] text-amber-950">
      <p>
        <strong>{nomeTipo}</strong> desde {dataBr(impedimento.data)}: {impedimento.justificativa}
      </p>
      {podeEditar && !aberto && (
        <button type="button" onClick={() => setAberto(true)} className="mt-1 text-xs font-medium text-amber-900 underline">
          Registrar resolução
        </button>
      )}
      {aberto && (
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(() => aoResolver(texto), () => setAberto(false));
          }}
        >
          <input className={cn(CAMPO, "max-w-md flex-1")} required minLength={3} placeholder="Como foi resolvido?" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>Resolver</button>
          {erro && <p className="w-full text-xs text-red-700">{erro}</p>}
        </form>
      )}
    </div>
  );
}

function LinhaMovimento({
  movimento,
  gestor,
  nome,
  aoCorrigir,
}: {
  movimento: DetalheEmenda["movimentos"][number];
  gestor: boolean;
  nome: string;
  aoCorrigir: (numero: string, data: string | null) => Promise<Resultado>;
}) {
  const [editando, setEditando] = React.useState(false);
  const [numero, setNumero] = React.useState(movimento.numero ?? "");
  const [data, setData] = React.useState(movimento.data ?? "");
  const faltando = !movimento.numero || !movimento.data;
  if (editando) {
    return (
      <tr className="border-t border-slate-100">
        <td className="px-3 py-2">{nome}</td>
        <td className="px-3 py-2"><input className={CAMPO} value={numero} onChange={(e) => setNumero(e.target.value)} aria-label="Número" /></td>
        <td className="px-3 py-2"><input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" /></td>
        <td className="px-3 py-2 text-right tabular-nums">{brl(movimento.valor)}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            aria-label="Salvar correção"
            className="rounded p-1.5 text-green-700 hover:bg-green-50"
            onClick={async () => {
              const r = await aoCorrigir(numero, data || null);
              if (r.sucesso) setEditando(false);
            }}
          >
            <Check className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2.5">{nome}</td>
      <td className="px-3 py-2.5 font-mono">{movimento.numero ?? <span className="font-sans text-amber-800">sem nº</span>}</td>
      <td className="px-3 py-2.5">{movimento.data ? dataBr(movimento.data) : <span className="text-amber-800">sem data</span>}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{brl(movimento.valor)}</td>
      {gestor && (
        <td className="px-3 py-2.5">
          <button type="button" aria-label="Corrigir número ou data" title={faltando ? "Completar número/data" : "Corrigir"} className={cn("rounded p-1.5 hover:bg-slate-100", faltando ? "text-amber-700" : "text-slate-500")} onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

function Documentos({
  emendaId,
  modalidade,
  documentos,
  podeEditar,
  gestor,
  executar,
}: {
  emendaId: string;
  modalidade: "repasse" | "direta";
  documentos: DetalheEmenda["documentos"];
  podeEditar: boolean;
  gestor: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
}) {
  const tipos = TIPOS_DOC.filter((t) => !t.modalidade || t.modalidade === modalidade);
  const [tipo, setTipo] = React.useState<TipoDocumento>(tipos[0].valor);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const entrada = React.useRef<HTMLInputElement>(null);

  async function enviar(arquivo: File) {
    setErro(null);
    if (arquivo.size > 25 * 1024 * 1024) return setErro("Arquivo maior que 25 MB.");
    setEnviando(true);
    const nomeSeguro = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-120);
    const caminho = `${emendaId}/${crypto.randomUUID()}-${nomeSeguro}`;
    const { error } = await criarClienteNavegador().storage.from("emendas-documentos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
    if (error) {
      setEnviando(false);
      return setErro("Não foi possível enviar o arquivo (sem permissão nesta secretaria?).");
    }
    const r = await executar(() => registrarDocumento({ emendaId, tipo, nomeArquivo: arquivo.name, caminho, tamanho: arquivo.size }));
    setEnviando(false);
    if (!r.sucesso) setErro(r.erro);
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-slate-600">
        Checklist de {modalidade === "repasse" ? "repasse a entidade (parceria)" : "aplicação direta (compra pela Prefeitura)"}. Arquivos ficam no próprio sistema, com acesso controlado pela secretaria.
      </p>
      <ul className="flex flex-col gap-2">
        {tipos.filter((t) => t.valor !== "outro").map((t) => {
          const anexos = documentos.filter((d) => d.tipo === t.valor);
          return (
            <li key={t.valor} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3.5 py-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-cataguases-marinho">{t.rotulo}</span>
                <span className={cn("text-xs", anexos.length ? "text-green-800" : "text-amber-800")}>{anexos.length ? `${anexos.length} anexo(s)` : "Não anexado"}</span>
              </span>
              {anexos.length > 0 && <ListaAnexos anexos={anexos} podeRemover={podeEditar || gestor} executar={executar} emendaId={emendaId} />}
            </li>
          );
        })}
        {documentos.some((d) => d.tipo === "outro") && (
          <li className="rounded-lg border border-slate-200 px-3.5 py-3">
            <span className="text-sm font-medium text-cataguases-marinho">Outros documentos</span>
            <ListaAnexos anexos={documentos.filter((d) => d.tipo === "outro")} podeRemover={podeEditar || gestor} executar={executar} emendaId={emendaId} />
          </li>
        )}
      </ul>
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Tipo do documento
            <select className={cn(CAMPO, "min-w-[240px]")} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
              {tipos.map((t) => (
                <option key={t.valor} value={t.valor}>{t.rotulo}</option>
              ))}
            </select>
          </label>
          <input ref={entrada} type="file" className="sr-only" id={`arquivo-${emendaId}`} onChange={(e) => e.target.files?.[0] && void enviar(e.target.files[0])} />
          <label htmlFor={`arquivo-${emendaId}`} className={cn(BOTAO_PRIMARIO, "cursor-pointer", enviando && "pointer-events-none opacity-50")}>
            <FileUp className="h-4 w-4" aria-hidden /> {enviando ? "Enviando…" : "Anexar arquivo"}
          </label>
          {erro && <p className="w-full text-xs text-red-700" role="alert">{erro}</p>}
        </div>
      )}
    </div>
  );
}

function ListaAnexos({
  anexos,
  podeRemover,
  executar,
  emendaId,
}: {
  anexos: DetalheEmenda["documentos"];
  podeRemover: boolean;
  executar: (acao: () => Promise<Resultado>) => Promise<Resultado>;
  emendaId: string;
}) {
  return (
    <ul className="flex w-full flex-col gap-1 sm:w-auto">
      {anexos.map((d) => (
        <li key={d.id} className="flex items-center gap-2 text-[13px]">
          <Paperclip className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <button
            type="button"
            className="max-w-[260px] truncate text-cataguases-azul hover:underline"
            onClick={async () => {
              const { url } = await linkDocumento(d.caminho);
              if (url) window.open(url, "_blank", "noopener");
            }}
          >
            {d.nome_arquivo}
          </button>
          <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {podeRemover && (
            <button
              type="button"
              aria-label={`Remover ${d.nome_arquivo}`}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
              onClick={() => window.confirm("Remover este arquivo?") && void executar(() => removerDocumento(d.id, emendaId))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

