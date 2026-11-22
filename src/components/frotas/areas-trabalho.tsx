"use client";

import * as React from "react";
import Link from "next/link";

import { AtualizarFipe } from "@/components/frotas/acoes-veiculos";
import { MenuExportarFrotas } from "@/components/frotas/menu-exportar-frotas";
import { AreaTrabalhoLista, type OrdemLista } from "@/components/modulo/area-trabalho-lista";
import { Bloco, Campos, Numeros, Passos } from "@/components/modulo/resumo-ui";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Selo, SeloDias } from "@/components/modulo/ui";
import { opcoesExportar } from "@/lib/frotas/exportacao";
import type { LinhaManutencao, LinhaNota, LinhaVeiculo } from "@/lib/frotas/area-trabalho";
import { brl, formatarData, pct, ROTULO_ETAPA_MANUTENCAO, type EtapaManutencao } from "@/lib/frotas/regras";
import { montarUrl } from "@/lib/frotas/url";
import type { Dimensao, Medida } from "@/lib/modulo/area-trabalho";
import { brlCurto } from "@/lib/moeda";

const NIVEL = { ok: "Sem alerta", atencao: "Atenção", critico: "Crítico" } as const;
const COR_NIVEL = { ok: "#94A3B8", atencao: "#D97706", critico: "#B91C1C" } as const;
const um = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;
const ao = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/** Só repassa ao exportador os filtros que o servidor entende (a exportação usa os mesmos nomes de parâmetro de antes). */
function filtrosDeExportacao(params: URLSearchParams, validosSit: Record<string, string>) {
  const sit = params.get("sit") ?? "";
  return { q: params.get("q") ?? undefined, sec: params.get("sec") ?? undefined, quinz: params.get("quinz") ?? undefined, vinc: params.get("vinc") ?? undefined, sit: validosSit[sit] ?? undefined };
}

// =====================================================================================================================
// Manutenção
// =====================================================================================================================

const TOM_ETAPA: Record<EtapaManutencao, "neutro" | "azul" | "verde" | "ambar" | "vermelho"> = { a_analisar: "azul", novo_orcamento: "ambar", recusada: "vermelho", liberada: "neutro", oc_emitida: "ambar", nf_registrada: "azul", concluida: "verde" };
const COR_ETAPA: Record<EtapaManutencao, string> = { a_analisar: "#6B8BE8", novo_orcamento: "#D97706", recusada: "#B91C1C", liberada: "#6B4FBB", oc_emitida: "#D98E04", nf_registrada: "#10B981", concluida: "#94A3B8" };
const ABERTAS: EtapaManutencao[] = ["a_analisar", "novo_orcamento", "liberada", "oc_emitida", "nf_registrada"];

const dimsManutencao: Dimensao<LinhaManutencao>[] = [
  {
    chave: "etapa", rotulo: "Etapa", param: "sit",
    valores: (l) => [{ chave: l.etapa, rotulo: ROTULO_ETAPA_MANUTENCAO[l.etapa], cor: COR_ETAPA[l.etapa] }],
    aliases: { andamento: ABERTAS, aguardando: ["oc_emitida"], concluidas: ["concluida"], recusadas: ["recusada"], todas: [] },
    rotulosAlias: { andamento: "Em andamento", aguardando: "Aguardando NF", todas: "Todas" },
    padrao: "andamento",
    ordem: ["a_analisar", "novo_orcamento", "liberada", "oc_emitida", "nf_registrada", "concluida", "recusada"],
  },
  { chave: "secretaria", rotulo: "Secretaria", param: "sec", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
  { chave: "alerta", rotulo: "Alerta de prazo", param: "alerta", valores: (l) => [{ chave: l.nivel, rotulo: NIVEL[l.nivel], cor: COR_NIVEL[l.nivel] }], ordem: ["critico", "atencao", "ok"] },
  { chave: "oficina", rotulo: "Oficina", param: "of", valores: (l) => [{ chave: l.oficinaId || "-", rotulo: l.oficina }] },
  { chave: "div", rotulo: "Conferência da NF", param: "div", valores: (l) => [l.nfAcimaOc !== null ? { chave: "nf_acima", rotulo: "NF acima da OC", cor: "#B91C1C" } : { chave: "ok", rotulo: "Sem divergência", cor: "#94A3B8" }] },
];
const medidasManutencao: Medida<LinhaManutencao>[] = [{ chave: "valor", rotulo: "R$", titulo: "Valor", valor: (l) => l.valor, dinheiro: true }];

const ordensManutencao: OrdemLista<LinhaManutencao>[] = [
  { chave: "recentes", rotulo: "Mais recentes", comparar: (a, b) => b.recebidoEm.localeCompare(a.recebidoEm) },
  { chave: "parada", rotulo: "Mais tempo parada", comparar: (a, b) => Number(b.emAndamento) - Number(a.emAndamento) || b.dias - a.dias },
  { chave: "valor", rotulo: "Maior valor", comparar: (a, b) => b.valor - a.valor },
  { chave: "veiculo", rotulo: "Veículo (A–Z)", comparar: (a, b) => ao(a.veiculo, b.veiculo) },
];

function linhaManutencao(l: LinhaManutencao) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium text-cataguases-marinho">{l.veiculo}</p>
        <p className="truncate text-xs text-slate-600">
          {l.servico}
          {l.ocNumero ? ` · OC ${l.ocNumero}` : ""} · {l.secretaria}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Selo tom={TOM_ETAPA[l.etapa]}>{l.etapaRotulo}</Selo>
          {l.emAndamento && l.nivel !== "ok" && <SeloDias dias={l.dias} nivel={l.nivel} />}
          {l.nfAcimaOc !== null && <Selo tom="vermelho">NF acima da OC</Selo>}
        </div>
      </div>
      <div className="flex-none text-right">
        <span className="block whitespace-nowrap text-[0.875rem] font-semibold tabular-nums text-cataguases-marinho">{brl(l.valor)}</span>
        <span className="block text-xs text-slate-500">{formatarData(l.recebidoEm)}</span>
      </div>
    </div>
  );
}

function resumoManutencao(l: LinhaManutencao) {
  const a = l.analise;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={TOM_ETAPA[l.etapa]}>{l.etapaRotulo}</Selo>
        {l.emAndamento && l.nivel !== "ok" && <SeloDias dias={l.dias} nivel={l.nivel} />}
        {l.nfAcimaOc !== null && <Selo tom="vermelho">NF {brl(l.nfAcimaOc)} acima da OC</Selo>}
      </div>
      <Bloco>
        <Campos itens={[["Serviço", l.servico], ["Oficina", l.oficina], ["Secretaria", l.secretaria], ["Orçamento recebido em", formatarData(l.recebidoEm)], ...(l.descricao ? ([["Descrição", l.descricao]] as [string, string][]) : [])]} />
      </Bloco>
      <Bloco titulo="Andamento">
        <Passos passos={l.passos.map((p) => ({ nome: p.nome, estado: p.estado, detalhe: p.data ? formatarData(p.data) : p.estado === "atual" ? "etapa atual" : undefined }))} />
        {l.analiseObs && (
          <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-[0.8125rem] text-slate-700">
            <strong className="font-semibold">Análise ({formatarData(l.analisadoEm)}):</strong> {l.analiseObs}
          </p>
        )}
      </Bloco>
      {a && (
        <Bloco titulo="Análise do orçamento · 12 meses">
          <Numeros
            itens={[
              { rotulo: "Orçamento", valor: brl(l.orcamento), apoio: a.valorReferencia ? `${pct((l.orcamento / a.valorReferencia) * 100)} do valor do veículo` : undefined },
              { rotulo: "Valor de referência", valor: a.valorReferencia ? brl(a.valorReferencia) : "—", apoio: a.valorReferencia ? (a.fonteValor === "fipe" ? "Tabela FIPE" : "Informado pelo setor") : "sem valor" },
              { rotulo: "Gasto em 12 meses", valor: brl(a.gasto12m) },
              { rotulo: "Com este orçamento", valor: a.pctComEste !== null ? pct(a.pctComEste) : "—", apoio: "do valor do veículo", tom: a.nivelComEste === "critico" ? "critico" : a.nivelComEste === "atencao" ? "alerta" : undefined },
            ]}
          />
          {a.acimaDaMediaPct !== null && a.mediaParecidos !== null && (
            <p className="mt-2 text-[0.8125rem] text-slate-700">
              <strong className="font-semibold">{pct(Math.abs(a.acimaDaMediaPct))} {a.acimaDaMediaPct > 0 ? "acima" : "abaixo"}</strong> da média de serviços parecidos na frota ({brl(a.mediaParecidos)}).
            </p>
          )}
        </Bloco>
      )}
      <Bloco titulo="Documentação">
        <Campos itens={[["OC (IPM)", l.ocNumero], ["Valor da OC", l.ocValor !== null ? brl(l.ocValor) : null], ["NF da oficina", l.nfNumero ? `${l.nfNumero}${l.nfValor !== null ? ` · ${brl(l.nfValor)}` : ""}` : null], ["Emissão da NF", l.nfEmissao ? formatarData(l.nfEmissao) : null], ["Enviada à Contabilidade", l.contabilidadeEm ? formatarData(l.contabilidadeEm) : null]]} />
      </Bloco>
    </div>
  );
}

export function AreaManutencao({ linhas, gestor }: { linhas: LinhaManutencao[]; gestor: boolean }) {
  return (
    <AreaTrabalhoLista
      chave="frotas-manutencao"
      titulo="Manutenção de veículos"
      unidades={{ singular: "manutenção", plural: "manutenções" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dimsManutencao}
      medidas={medidasManutencao}
      graficos={["etapa", "secretaria"]}
      textoBusca={(l) => `${l.veiculo} ${l.servico} ${l.ocNumero ?? ""} ${l.nfNumero ?? ""} ${l.secretaria} ${l.oficina}`}
      placeholderBusca="OC, NF, placa, serviço ou secretaria"
      ordens={ordensManutencao}
      kpis={(f) => [
        { rotulo: "Manutenções", valor: String(f.length), apoio: `${f.filter((l) => l.emAndamento).length} em andamento` },
        { rotulo: "Valor", valor: brlCurto(f.reduce((s, l) => s + l.valor, 0)) },
        { rotulo: "Com alerta", valor: String(f.filter((l) => l.nivel !== "ok").length), apoio: "além do prazo" },
        { rotulo: "NF acima da OC", valor: String(f.filter((l) => l.nfAcimaOc !== null).length) },
      ]}
      renderLinha={linhaManutencao}
      corLinha={(l) => (l.nivel === "critico" ? "#B91C1C" : l.nivel === "atencao" ? "#D97706" : COR_ETAPA[l.etapa])}
      renderResumo={resumoManutencao}
      tituloResumo={(l) => l.veiculo}
      subtituloResumo={(l) => `${l.servico} · ${l.secretaria}`}
      hrefPagina={(l) => `/frotas/manutencao?id=${l.id}`}
      rotuloPagina={gestor ? "Abrir e editar" : "Abrir"}
      vazio="Nenhuma manutenção registrada ainda."
      acoes={(params) => (
        <>
          <MenuExportarFrotas
            opcoes={opcoesExportar(
              [
                { r: "manutencoes", rotulo: "Manutenções da lista", formatos: ["xlsx", "pdf", "csv"] },
                { r: "contabilidade", rotulo: "Remessa à Contabilidade", formatos: ["pdf"] },
              ],
              { q: params.get("q") ?? undefined, ...(() => { const sit = params.get("sit") ?? ""; const mapa: Record<string, string> = { a_analisar: "a_analisar", oc_emitida: "aguardando", concluida: "concluidas", recusada: "recusadas", andamento: "andamento", aguardando: "aguardando", concluidas: "concluidas", recusadas: "recusadas", todas: "todas" }; return { sit: mapa[sit] }; })() }
            )}
          />
          {gestor && (
            <>
              <Link href="/frotas/manutencao/importar" className={CLASSE_BOTAO_SECUNDARIO}>
                Importar PDFs
              </Link>
              <Link href="/frotas/manutencao?novo=1" className={CLASSE_BOTAO}>
                Registrar orçamento
              </Link>
            </>
          )}
        </>
      )}
    />
  );
}

// =====================================================================================================================
// Veículos
// =====================================================================================================================

const VINCULO = { proprio: "Próprio", convenio: "Convênio", alugado: "Alugado" } as const;
const COR_VINCULO = { proprio: "#5C7A1F", convenio: "#0E7490", alugado: "#D98E04" } as const;
const SITUACAO = { ativo: "Ativo", em_manutencao: "Em manutenção", inativo: "Inativo", baixado: "Baixado" } as const;
const COR_SITUACAO = { ativo: "#059669", em_manutencao: "#D97706", inativo: "#64748B", baixado: "#94A3B8" } as const;
const COMBUSTIVEL = { gasolina: "Gasolina", flex: "Flex", diesel: "Diesel", diesel_s10: "Diesel S10" } as const;

const dimsVeiculos: Dimensao<LinhaVeiculo>[] = [
  { chave: "vinculo", rotulo: "Vínculo", param: "vinc", valores: (l) => [{ chave: l.vinculo, rotulo: VINCULO[l.vinculo], cor: COR_VINCULO[l.vinculo] }], ordem: ["proprio", "convenio", "alugado"] },
  { chave: "secretaria", rotulo: "Secretaria", param: "sec", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
  { chave: "situacao", rotulo: "Situação", param: "sit", valores: (l) => [{ chave: l.situacao, rotulo: SITUACAO[l.situacao], cor: COR_SITUACAO[l.situacao] }], ordem: ["ativo", "em_manutencao", "inativo", "baixado"] },
  { chave: "aviso", rotulo: "Cadastro", param: "rev", valores: (l) => [l.avisos.length ? { chave: "1", rotulo: "Com aviso a revisar", cor: "#D97706" } : { chave: "0", rotulo: "Sem aviso", cor: "#059669" }], ordem: ["1", "0"] },
  { chave: "valor", rotulo: "Valor de referência", param: "vf", valores: (l) => [l.vinculo === "alugado" ? { chave: "na", rotulo: "Não se aplica (alugado)", cor: "#94A3B8" } : l.semValor ? { chave: "falta", rotulo: "Falta o valor", cor: "#D97706" } : { chave: "tem", rotulo: l.valorFonte === "fipe" ? "FIPE" : "Informado", cor: "#059669" }] },
  { chave: "combustivel", rotulo: "Combustível", param: "comb", valores: (l) => [{ chave: l.combustivel ?? "-", rotulo: l.combustivel ? COMBUSTIVEL[l.combustivel] : "Não informado" }] },
];
const medidasVeiculos: Medida<LinhaVeiculo>[] = [
  { chave: "gasto", rotulo: "R$ manut.", titulo: "Manutenção em 12 meses", valor: (l) => l.gasto12m, dinheiro: true },
  { chave: "ref", rotulo: "R$ valor", titulo: "Valor de referência", valor: (l) => l.valorReferencia ?? 0, dinheiro: true },
];
const ordensVeiculos: OrdemLista<LinhaVeiculo>[] = [
  { chave: "placa", rotulo: "Placa (A–Z)", comparar: (a, b) => ao(a.placa, b.placa) },
  { chave: "gasto", rotulo: "Maior gasto em 12 meses", comparar: (a, b) => b.gasto12m - a.gasto12m },
  { chave: "valor", rotulo: "Maior valor de referência", comparar: (a, b) => (b.valorReferencia ?? 0) - (a.valorReferencia ?? 0) },
  { chave: "aviso", rotulo: "Com aviso primeiro", comparar: (a, b) => b.avisos.length - a.avisos.length || ao(a.placa, b.placa) },
];

function linhaVeiculo(l: LinhaVeiculo) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium text-cataguases-marinho">
          {l.placa} <span className="font-normal text-slate-600">· {l.modelo}</span>
        </p>
        <p className="truncate text-xs text-slate-600">
          {[l.marca, l.ano, l.secretaria + (l.setor ? ` · ${l.setor}` : "")].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Selo tom={l.vinculo === "alugado" ? "ambar" : l.vinculo === "convenio" ? "azul" : "neutro"}>{VINCULO[l.vinculo]}</Selo>
          <Selo tom={l.situacao === "ativo" ? "verde" : l.situacao === "em_manutencao" ? "ambar" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
          {l.semValor && <Selo tom="ambar">Falta o valor</Selo>}
          {l.avisos.length > 0 && <Selo tom="vermelho">{um(l.avisos.length, "aviso", "avisos")}</Selo>}
        </div>
      </div>
      <div className="flex-none text-right">
        <span className="block whitespace-nowrap text-[0.875rem] font-semibold tabular-nums text-cataguases-marinho">{l.valorReferencia ? brl(l.valorReferencia) : "—"}</span>
        <span className="block text-xs text-slate-500">{l.gasto12m ? `${brlCurto(l.gasto12m)} em 12 m` : l.vinculo === "alugado" ? "alugado" : "sem manutenção"}</span>
      </div>
    </div>
  );
}

function resumoVeiculo(l: LinhaVeiculo) {
  const pctValor = l.valorReferencia ? (l.gasto12m / l.valorReferencia) * 100 : null;
  return (
    <div className="flex flex-col gap-3.5">
      {l.avisos.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[0.8125rem] text-amber-900">
          <p className="font-semibold">Dados a revisar</p>
          <ul className="mt-0.5 list-disc pl-4">
            {l.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <Bloco>
        <Campos
          itens={[
            ["Modelo", `${l.modelo}${l.marca ? ` · ${l.marca}` : ""}`],
            ["Ano", l.ano],
            ["Combustível", l.combustivel ? COMBUSTIVEL[l.combustivel] : null],
            ["Patrimônio", l.patrimonio],
            ["Vínculo", VINCULO[l.vinculo]],
            ["Situação", SITUACAO[l.situacao] + (l.motivoSituacao ? ` — ${l.motivoSituacao}` : "")],
            ["Secretaria", l.secretaria],
            ["Setor", l.setor],
          ]}
        />
      </Bloco>
      <Bloco titulo="Valor e manutenção">
        <Numeros
          itens={[
            { rotulo: "Valor de referência", valor: l.vinculo === "alugado" ? "Não se aplica" : l.valorReferencia ? brl(l.valorReferencia) : "Falta o valor", apoio: l.valorReferencia ? (l.valorFonte === "fipe" ? "Tabela FIPE" : "Informado") : undefined, tom: l.semValor ? "alerta" : undefined },
            { rotulo: "Manutenção em 12 meses", valor: brl(l.gasto12m), apoio: pctValor !== null ? `${pct(pctValor)} do valor` : um(l.servicos12m, "serviço", "serviços") },
          ]}
        />
      </Bloco>
      <Bloco titulo="Últimas manutenções">
        {l.ultimas.length === 0 ? (
          <p className="text-[0.8125rem] text-slate-600">Nenhuma manutenção liberada.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-[0.8125rem]">
            {l.ultimas.map((m) => (
              <li key={m.id}>
                <Link href={`/frotas/manutencao?id=${m.id}`} className="flex justify-between gap-3 py-2 hover:text-[color:var(--modulo-tinta)]">
                  <span>
                    {formatarData(m.data)} · {m.servico}
                  </span>
                  <span className="font-semibold tabular-nums">{brl(m.valor)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}

export function AreaVeiculos({ linhas, gestor }: { linhas: LinhaVeiculo[]; gestor: boolean }) {
  return (
    <AreaTrabalhoLista
      chave="frotas-veiculos"
      titulo="Veículos"
      unidades={{ singular: "veículo", plural: "veículos" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dimsVeiculos}
      medidas={medidasVeiculos}
      graficos={["vinculo", "secretaria"]}
      textoBusca={(l) => `${l.placa} ${l.modelo} ${l.marca ?? ""} ${l.patrimonio ?? ""} ${l.secretaria} ${l.setor ?? ""}`}
      placeholderBusca="Placa, modelo, marca, patrimônio ou secretaria"
      ordens={ordensVeiculos}
      kpis={(f) => [
        { rotulo: "Veículos", valor: String(f.length) },
        { rotulo: "Valor de referência", valor: brlCurto(f.reduce((s, l) => s + (l.valorReferencia ?? 0), 0)) },
        { rotulo: "Manutenção 12 m", valor: brlCurto(f.reduce((s, l) => s + l.gasto12m, 0)) },
        { rotulo: "Com aviso", valor: String(f.filter((l) => l.avisos.length > 0).length) },
      ]}
      renderLinha={linhaVeiculo}
      corLinha={(l) => (l.avisos.length ? "#D97706" : COR_VINCULO[l.vinculo])}
      renderResumo={resumoVeiculo}
      tituloResumo={(l) => `${l.placa} · ${l.modelo}`}
      subtituloResumo={(l) => l.secretaria}
      hrefPagina={(l) => (gestor ? `/frotas/veiculos?editar=${l.id}` : null)}
      rotuloPagina="Abrir e editar"
      vazio="Nenhum veículo cadastrado ainda."
      acoes={(params) => (
        <>
          {gestor && <AtualizarFipe />}
          <MenuExportarFrotas opcoes={opcoesExportar([{ r: "veiculos", rotulo: "Veículos da lista", formatos: ["xlsx", "pdf", "csv"] }], { q: params.get("q") ?? undefined, sec: params.get("sec") ?? undefined, vinc: params.get("vinc") ?? undefined, sit: params.get("sit") ?? undefined, rev: params.get("rev") ?? undefined })} />
          {gestor && (
            <>
              <Link href="/frotas/veiculos/importar" className={CLASSE_BOTAO_SECUNDARIO}>
                Importar planilha
              </Link>
              <Link href="/frotas/veiculos?novo=1" className={CLASSE_BOTAO}>
                Novo veículo
              </Link>
            </>
          )}
        </>
      )}
    />
  );
}

// =====================================================================================================================
// Combustível
// =====================================================================================================================

const ROTULO_NF: Record<LinhaNota["situacao"], string> = { recebida: "Recebida, a enviar", com_secretaria: "Com a secretaria", assinada: "Assinada, a enviar", na_contabilidade: "Na Contabilidade", arquivada: "Arquivada (+30 dias)" };
const COR_NF: Record<LinhaNota["situacao"], string> = { recebida: "#94A3B8", com_secretaria: "#D97706", assinada: "#2563EB", na_contabilidade: "#10B981", arquivada: "#CBD5E1" };
const TOM_NF = { recebida: "neutro", com_secretaria: "ambar", assinada: "azul", na_contabilidade: "verde", arquivada: "neutro" } as const;
const quinzenaRotulo = (l: { quinzenaInicio: string; quinzenaFim: string }) => `${formatarData(l.quinzenaInicio).slice(0, 5)} a ${formatarData(l.quinzenaFim)}`;

function dimsCombustivel(linhas: LinhaNota[]): Dimensao<LinhaNota>[] {
  const quinzenas = [...new Set(linhas.map((l) => l.quinzenaInicio))].sort().reverse();
  return [
    {
      chave: "situacao", rotulo: "Situação", param: "sit",
      valores: (l) => [{ chave: l.situacao, rotulo: ROTULO_NF[l.situacao], cor: COR_NF[l.situacao] }],
      aliases: { ativas: ["recebida", "com_secretaria", "assinada", "na_contabilidade"], na_contabilidade: ["na_contabilidade", "arquivada"], todas: [] },
      rotulosAlias: { ativas: "Em andamento", na_contabilidade: "Na Contabilidade", todas: "Todas" },
      padrao: "ativas",
      ordem: ["recebida", "com_secretaria", "assinada", "na_contabilidade", "arquivada"],
    },
    { chave: "secretaria", rotulo: "Secretaria", param: "sec", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
    { chave: "quinzena", rotulo: "Quinzena", param: "quinz", valores: (l) => [{ chave: l.quinzenaInicio, rotulo: quinzenaRotulo(l) }], ordem: quinzenas },
    { chave: "alerta", rotulo: "Alerta de prazo", param: "alerta", valores: (l) => [{ chave: l.nivel, rotulo: NIVEL[l.nivel], cor: COR_NIVEL[l.nivel] }], ordem: ["critico", "atencao", "ok"] },
    { chave: "posto", rotulo: "Posto", param: "posto", valores: (l) => [{ chave: l.postoId || "-", rotulo: l.posto }] },
  ];
}
const medidasCombustivel: Medida<LinhaNota>[] = [{ chave: "valor", rotulo: "R$", titulo: "Valor", valor: (l) => l.valor, dinheiro: true }];
const ordensCombustivel: OrdemLista<LinhaNota>[] = [
  { chave: "recentes", rotulo: "Mais recentes", comparar: (a, b) => b.emissao.localeCompare(a.emissao) },
  { chave: "parada", rotulo: "Mais tempo parada", comparar: (a, b) => Number(b.pendente) - Number(a.pendente) || b.dias - a.dias },
  { chave: "valor", rotulo: "Maior valor", comparar: (a, b) => b.valor - a.valor },
  { chave: "secretaria", rotulo: "Secretaria (A–Z)", comparar: (a, b) => ao(a.secretaria, b.secretaria) || b.emissao.localeCompare(a.emissao) },
];

function linhaNota(l: LinhaNota) {
  const alerta = l.pendente && l.etapa !== "recebida" && l.nivel !== "ok";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium text-cataguases-marinho">
          {l.secretaria} <span className="font-normal text-slate-600">· NF {l.numero}</span>
        </p>
        <p className="truncate text-xs text-slate-600">
          Quinzena {quinzenaRotulo(l)} · {l.posto}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Selo tom={TOM_NF[l.situacao]}>{l.etapaRotulo}</Selo>
          {alerta && <SeloDias dias={l.dias} nivel={l.nivel} />}
        </div>
      </div>
      <div className="flex-none text-right">
        <span className="block whitespace-nowrap text-[0.875rem] font-semibold tabular-nums text-cataguases-marinho">{brl(l.valor)}</span>
        <span className="block text-xs text-slate-500">{formatarData(l.emissao)}</span>
      </div>
    </div>
  );
}

function resumoNota(l: LinhaNota) {
  const feitos = [true, !!l.enviadaEm, !!l.retornouEm, !!l.contabilidadeEm];
  const atual = feitos.findIndex((f) => !f);
  const estado = (i: number) => (feitos[i] ? ("feito" as const) : i === atual ? ("atual" as const) : ("futuro" as const));
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={TOM_NF[l.situacao]}>{l.etapaRotulo}</Selo>
        {l.pendente && l.etapa !== "recebida" && l.nivel !== "ok" && <SeloDias dias={l.dias} nivel={l.nivel} />}
      </div>
      <Numeros itens={[{ rotulo: "Valor da NF", valor: brl(l.valor) }, { rotulo: l.pendente ? "Parada nesta etapa" : "Na etapa atual", valor: um(l.dias, "dia", "dias"), tom: l.nivel === "critico" ? "critico" : l.nivel === "atencao" ? "alerta" : undefined }]} />
      <Bloco titulo="Caminho da NF">
        <Passos
          passos={[
            { nome: "NF recebida", estado: estado(0), detalhe: formatarData(l.emissao) },
            { nome: "Enviada à secretaria", estado: estado(1), detalhe: l.enviadaEm ? formatarData(l.enviadaEm) : undefined },
            { nome: "Devolvida assinada", estado: estado(2), detalhe: l.retornouEm ? formatarData(l.retornouEm) : undefined },
            { nome: "Enviada à Contabilidade", estado: estado(3), detalhe: l.contabilidadeEm ? formatarData(l.contabilidadeEm) : undefined },
          ]}
        />
      </Bloco>
      <Bloco>
        <Campos itens={[["Secretaria", l.secretaria], ["Posto", l.posto], ["Quinzena", quinzenaRotulo(l)], ["Nº da NF", l.numero]]} />
        {l.observacoes && <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[0.8125rem] text-slate-700">{l.observacoes}</p>}
      </Bloco>
    </div>
  );
}

export function AreaCombustivel({ linhas, gestor }: { linhas: LinhaNota[]; gestor: boolean }) {
  const dims = dimsCombustivel(linhas);
  return (
    <AreaTrabalhoLista
      chave="frotas-combustivel"
      titulo="Notas fiscais de combustível"
      unidades={{ singular: "NF", plural: "NFs" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dims}
      medidas={medidasCombustivel}
      graficos={["situacao", "secretaria"]}
      textoBusca={(l) => `${l.numero} ${l.secretaria} ${l.posto}`}
      placeholderBusca="Nº da NF, secretaria ou posto"
      ordens={ordensCombustivel}
      kpis={(f) => [
        { rotulo: "NFs", valor: String(f.length) },
        { rotulo: "Valor", valor: brlCurto(f.reduce((s, l) => s + l.valor, 0)) },
        { rotulo: "Com a secretaria", valor: String(f.filter((l) => l.etapa === "com_secretaria").length) },
        { rotulo: "Com alerta", valor: String(f.filter((l) => l.nivel !== "ok").length), apoio: "além do prazo" },
      ]}
      renderLinha={linhaNota}
      corLinha={(l) => (l.nivel === "critico" ? "#B91C1C" : l.nivel === "atencao" ? "#D97706" : COR_NF[l.situacao])}
      renderResumo={resumoNota}
      tituloResumo={(l) => `NF ${l.numero} · ${l.secretaria}`}
      subtituloResumo={(l) => `Quinzena ${quinzenaRotulo(l)}`}
      hrefPagina={(l) => (gestor ? `/frotas/combustivel?editar=${l.id}` : null)}
      rotuloPagina="Abrir e editar"
      vazio="Nenhuma NF lançada ainda."
      acoes={(params) => (
        <>
          <MenuExportarFrotas
            opcoes={opcoesExportar(
              [
                { r: "combustivel", rotulo: "NFs da lista", formatos: ["xlsx", "pdf", "csv"] },
                { r: "contabilidade", rotulo: "Remessa à Contabilidade", formatos: ["pdf"] },
              ],
              filtrosDeExportacao(params, { recebida: "recebida", com_secretaria: "com_secretaria", assinada: "assinada", na_contabilidade: "na_contabilidade", todas: "todas", ativas: "ativas" })
            )}
          />
          {gestor && (
            <Link href={montarUrl("/frotas/combustivel", { novo: "1" })} className={CLASSE_BOTAO}>
              Lançar NF
            </Link>
          )}
        </>
      )}
    />
  );
}
