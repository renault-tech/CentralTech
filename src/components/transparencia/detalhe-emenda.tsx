"use client";

import { Check, FileText, Minus } from "lucide-react";

import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { partes, situacaoPublica } from "@/lib/emendas/portal-agregados";
import type { LinhaPortal } from "@/lib/emendas/portal-tipos";
import { brl, dataBr, pct } from "@/lib/emendas/regras";

import { BarraExecucao, Legenda } from "./graficos";
import { SeloSituacao } from "./selos";

const NOME_MOV = { empenho: "Empenho", liquidacao: "Liquidação", pagamento: "Pagamento", anulacao: "Anulação" } as const;
const SUS = { sim: "Sim, houve anuência prévia do gestor do SUS", nao: "Não houve anuência prévia", nao_se_aplica: "Não se aplica" } as const;

function Campo({ rotulo, valor, inciso, largo }: { rotulo: string; valor: React.ReactNode; inciso?: string; largo?: boolean }) {
  const vazio = valor === null || valor === undefined || valor === "";
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="flex items-baseline gap-1.5 text-[12px] text-[var(--p-tinta-3)]">
        {rotulo}
        {inciso && <span className="text-[10.5px] tracking-wide opacity-70">art. 7º, {inciso}</span>}
      </dt>
      <dd className={`mt-0.5 text-[14.5px] leading-snug ${vazio ? "italic text-[var(--p-tinta-3)]" : "font-medium text-[var(--p-tinta)]"}`}>{vazio ? "Não informado" : valor}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--p-linha)] py-5 first:border-t-0 first:pt-0">
      <h3 className="portal-rotulo mb-3">{titulo}</h3>
      {children}
    </section>
  );
}

export function DetalheEmenda({ l, nomeEtapa }: { l: LinhaPortal; nomeEtapa: (c: string) => string }) {
  const p = partes(l);
  const repasse = l.tipo !== "direta";
  const recebedor = l.beneficiario ?? (l.tipo === "direta" ? l.municipio : null);
  const cronograma =
    l.inicioPrevisto || l.terminoPrevisto
      ? `${l.inicioPrevisto ? dataBr(l.inicioPrevisto) : "—"} a ${l.terminoPrevisto ? dataBr(l.terminoPrevisto) : "—"}`
      : l.vigenciaInicio || l.vigenciaFim
        ? `${l.vigenciaInicio ? dataBr(l.vigenciaInicio) : "—"} a ${l.vigenciaFim ? dataBr(l.vigenciaFim) : "—"} (vigência do termo)`
        : null;
  const planos = l.documentos.filter((d) => d.tipo === "plano_trabalho");
  const relatorios = l.documentos.filter((d) => d.tipo === "relatorio_gestao");

  return (
    <div className="text-[var(--p-tinta)]">
      <div className="mb-6 rounded-2xl bg-[var(--p-superficie-2)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[28px] font-semibold tracking-tight tabular-nums">{brl(l.valor)}</p>
          <SeloSituacao s={situacaoPublica(l)} />
        </div>
        <div className="mt-3">
          <BarraExecucao p={p} altura={12} titulo={`Emenda nº ${l.numero}`} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          {[
            ["Pago", p.pago],
            ["A pagar", p.aPagar],
            ["A empenhar", p.aEmpenhar],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-[var(--p-tinta-3)]">{k}</dt>
              <dd className="font-semibold tabular-nums">{brl(v as number)}</dd>
              <dd className="text-[12px] text-[var(--p-tinta-3)] tabular-nums">{pct((v as number) / (l.valor || 1))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3">
          <Legenda />
        </div>
      </div>

      <Secao titulo="O quê">
        <p className="text-[16px] font-semibold leading-snug">{l.objeto}</p>
        {l.descricao && l.descricao !== l.objeto && <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[var(--p-tinta-2)]">{l.descricao}</p>}
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Campo rotulo="Localidade beneficiada" inciso="VI" valor={l.localidade} />
          <Campo rotulo="Cronograma previsto" inciso="VII" valor={cronograma} />
          <Campo rotulo="Fase atual" valor={nomeEtapa(l.etapa)} />
          <Campo rotulo="Área" valor={l.saude ? "Saúde (ações e serviços públicos de saúde)" : "Demais áreas"} />
          {l.planoMetas && <Campo rotulo="Finalidade e metas (plano de trabalho)" inciso="IX" valor={<span className="whitespace-pre-line">{l.planoMetas}</span>} largo />}
          {l.impedimento && <Campo rotulo="Impedimento" valor={l.impedimento} largo />}
        </dl>
      </Secao>

      <Secao titulo="Quem indicou">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Campo rotulo="Vereador(a)" inciso="I" valor={l.vereador} />
          <Campo rotulo="Partido" inciso="I" valor={l.partido} />
          <Campo rotulo="Unidade parlamentar" inciso="I" valor={l.unidadeParlamentar} />
          <Campo rotulo="Emenda no orçamento" inciso="II" valor={`nº ${l.numero}/${l.ano}${l.leiLoa ? ` · ${l.leiLoa}` : ""}`} />
        </dl>
      </Secao>

      <Secao titulo="Para quem e por quem">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Campo rotulo="Tipo de execução" valor={TIPOS_EXECUCAO[l.tipo].nome} />
          <Campo rotulo="Órgão executor" inciso="V" valor={`${l.secretaria} · ${l.unidade}`} />
          <Campo rotulo="Recebedor / beneficiário final" inciso="XI" valor={recebedor} />
          <Campo rotulo="CNPJ do recebedor" inciso="XI" valor={l.cnpj} />
          <Campo rotulo="Município" inciso="XII" valor={l.municipio ? `${l.municipio}${l.municipioCnpj ? ` · CNPJ ${l.municipioCnpj}` : ""}` : null} />
          <Campo rotulo="Gestor responsável (Prefeitura)" inciso="XIV" valor={l.gestorPrefeitura} />
          {repasse && <Campo rotulo="Gestor responsável (entidade)" inciso="XIV" valor={l.gestorEntidade} />}
          {l.saude && <Campo rotulo="Anuência prévia do SUS" inciso="XVII" valor={l.anuenciaSus ? SUS[l.anuenciaSus] : null} largo />}
        </dl>
      </Secao>

      <Secao titulo="Orçamento e instrumentos">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Campo rotulo="Funcional programática" valor={l.funcional} />
          <Campo rotulo="Natureza da despesa" valor={l.natureza} />
          <Campo rotulo="Grupo de natureza (GND)" inciso="XV" valor={l.gnd ? `${l.gnd}${l.categoria ? ` · ${l.categoria}` : ""}` : null} />
          <Campo rotulo="Fonte de recurso" valor={l.fonteRecurso} />
          {repasse && <Campo rotulo="Termo / instrumento" inciso="VIII" valor={l.termo} />}
          <Campo rotulo="Processo administrativo" inciso="VIII" valor={l.processo} />
          {(l.contrato || !repasse) && <Campo rotulo="Contrato" inciso="VIII" valor={l.contrato} />}
          {repasse && <Campo rotulo="Extrato publicado em" valor={l.extratoPublicadoEm ? dataBr(l.extratoPublicadoEm) : null} />}
          {repasse && <Campo rotulo="Banco e conta dos recursos" inciso="XVI" valor={l.conta} largo />}
          {l.planoOutrasFontes != null && l.planoOutrasFontes > 0 && <Campo rotulo="Outras fontes previstas no plano" inciso="IX" valor={brl(l.planoOutrasFontes)} />}
        </dl>
      </Secao>

      <Secao titulo="Linha do tempo do dinheiro">
        <p className="mb-3 text-[12px] text-[var(--p-tinta-3)]">Datas de disponibilização do recurso (art. 7º, XIII): empenho reserva, liquidação confere a entrega, pagamento transfere.</p>
        {l.movimentos.length === 0 ? (
          <p className="text-[14px] text-[var(--p-tinta-2)]">Ainda sem movimentação financeira.</p>
        ) : (
          <ol className="relative ml-1.5 border-l border-[var(--p-linha-forte)]">
            {l.movimentos.map((m, i) => (
              <li key={i} className="relative pb-4 pl-5 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--p-superficie)]"
                  style={{ background: m.tipo === "pagamento" ? "var(--s-pago)" : m.tipo === "anulacao" ? "var(--e-impedida)" : "var(--s-apagar)" }}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[14px] font-semibold">{NOME_MOV[m.tipo]}</span>
                  <span className="text-[14px] font-semibold tabular-nums">{m.tipo === "anulacao" ? "− " : ""}{brl(m.valor)}</span>
                </div>
                <p className="text-[12.5px] text-[var(--p-tinta-3)]">
                  {m.data ? dataBr(m.data) : "data não informada"}
                  {m.numero ? ` · nº ${m.numero}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Secao>

      <Secao titulo="Documentos">
        <ul className="flex flex-col gap-2">
          {repasse || planos.length ? (
            <ItemDocumento rotulo="Plano de trabalho" inciso="IX" docs={planos} />
          ) : null}
          <ItemDocumento rotulo="Relatório de gestão" inciso="X" docs={relatorios} vazio="Disponibilizado até 30 de junho do ano seguinte ao recebimento dos recursos." />
          {l.documentos.filter((d) => d.tipo === "anuencia_sus").length > 0 && <ItemDocumento rotulo="Anuência do SUS" inciso="XVII" docs={l.documentos.filter((d) => d.tipo === "anuencia_sus")} />}
        </ul>
      </Secao>
    </div>
  );
}

function ItemDocumento({ rotulo, inciso, docs, vazio }: { rotulo: string; inciso: string; docs: LinhaPortal["documentos"]; vazio?: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-[var(--p-linha)] p-3">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${docs.length ? "bg-[var(--p-acento-suave)] text-[var(--p-acento-texto)]" : "bg-[var(--p-superficie-2)] text-[var(--p-tinta-3)]"}`}>
        {docs.length ? <Check className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">
          {rotulo} <span className="text-[11px] font-normal text-[var(--p-tinta-3)]">art. 7º, {inciso}</span>
        </p>
        {docs.length === 0 ? (
          <p className="text-[13px] text-[var(--p-tinta-3)]">{vazio ?? "Ainda não disponibilizado."}</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {docs.map((d) => (
              <a key={d.id} href={`/transparencia/emendas/documento/${d.id}`} target="_blank" rel="noopener" className="portal-botao-sec !min-h-9 !px-3 !text-[13px]">
                <FileText className="h-4 w-4" aria-hidden />
                {d.competencia ? `${d.competencia} · ` : ""}Abrir PDF
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
