"use client";

import type { ColunaCsv } from "@/lib/modulo/csv";

import * as React from "react";
import Link from "next/link";

import { BotaoJustificar } from "@/components/imoveis/botao-justificar";
import { MenuExportarImoveis } from "@/components/imoveis/menu-exportar-imoveis";
import { AreaTrabalhoLista, type OrdemLista } from "@/components/modulo/area-trabalho-lista";
import { Bloco, Campos, Numeros, Passos } from "@/components/modulo/resumo-ui";
import { CLASSE_BOTAO, Selo, SeloDias, SeloNivel } from "@/components/modulo/ui";
import { ROTULO_ASSUNTO, type LinhaEntrega, type LinhaImovel, type LinhaPendencia, type NivelVigencia } from "@/lib/imoveis/area-trabalho";
import { brl, formatarData, rotuloMes } from "@/lib/imoveis/regras";
import type { Dimensao, Medida } from "@/lib/modulo/area-trabalho";
import { brlCurto } from "@/lib/moeda";
import { cn } from "@/lib/utils";

const ao = (a: string, b: string) => a.localeCompare(b, "pt-BR");
const um = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

const SITUACAO = { ativo: "Ativo", em_entrega: "Em entrega", entregue: "Entregue" } as const;
const COR_SITUACAO = { ativo: "#059669", em_entrega: "#D97706", entregue: "#94A3B8" } as const;
const VINCULO = { alugado: "Alugado", proprio: "Próprio", cedido: "Cedido" } as const;
const COR_VINCULO = { alugado: "#0E7490", proprio: "#5C7A1F", cedido: "#7C5CD6" } as const;
const VIGENCIA: Record<NivelVigencia, string> = { vencido: "Vencido", critico: "Vence em até 30 dias", atencao: "Vence em breve", ok: "Vigente", sem_fim: "Sem data de fim", entregue: "Entregue" };
const COR_VIGENCIA: Record<NivelVigencia, string> = { vencido: "#B91C1C", critico: "#D97706", atencao: "#E9A63B", ok: "#0E7490", sem_fim: "#94A3B8", entregue: "#CBD5E1" };
const COR_GRAVIDADE = { critico: "#B91C1C", atencao: "#D97706" } as const;

// =====================================================================================================================
// Imóveis
// =====================================================================================================================

const dimsImoveis: Dimensao<LinhaImovel>[] = [
  { chave: "situacao", rotulo: "Situação", param: "sit", valores: (l) => [{ chave: l.situacao, rotulo: SITUACAO[l.situacao], cor: COR_SITUACAO[l.situacao] }], ordem: ["ativo", "em_entrega", "entregue"] },
  { chave: "vinculo", rotulo: "Vínculo", param: "vinc", valores: (l) => [{ chave: l.vinculo, rotulo: VINCULO[l.vinculo], cor: COR_VINCULO[l.vinculo] }], ordem: ["alugado", "proprio", "cedido"] },
  { chave: "secretaria", rotulo: "Secretaria", param: "sec", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
  { chave: "vigencia", rotulo: "Contrato", param: "vig", valores: (l) => [{ chave: l.vigencia.nivel, rotulo: VIGENCIA[l.vigencia.nivel], cor: COR_VIGENCIA[l.vigencia.nivel] }], ordem: ["vencido", "critico", "atencao", "ok", "sem_fim", "entregue"] },
  { chave: "pendencia", rotulo: "Pendências", param: "alerta", valores: (l) => [l.pendencias.length ? { chave: "1", rotulo: "Com pendência", cor: l.pendencias.some((p) => p.nivel === "critico") ? "#B91C1C" : "#D97706" } : { chave: "0", rotulo: "Sem pendência", cor: "#059669" }], ordem: ["1", "0"] },
];
const medidasImoveis: Medida<LinhaImovel>[] = [
  { chave: "aluguel", rotulo: "R$ aluguel", titulo: "Aluguel", valor: (l) => l.aluguel, dinheiro: true },
  { chave: "consumo", rotulo: "R$ água e luz", titulo: "Água e luz do mês", valor: (l) => l.agua + l.luz, dinheiro: true },
];
const ordensImoveis: OrdemLista<LinhaImovel>[] = [
  { chave: "nome", rotulo: "Nome (A–Z)", comparar: (a, b) => ao(a.nome, b.nome) },
  { chave: "aluguel", rotulo: "Maior aluguel", comparar: (a, b) => b.aluguel - a.aluguel },
  { chave: "consumo", rotulo: "Maior gasto de água e luz", comparar: (a, b) => b.agua + b.luz - (a.agua + a.luz) },
  { chave: "fim", rotulo: "Contrato termina primeiro", comparar: (a, b) => (a.vigenciaFim ?? "9999").localeCompare(b.vigenciaFim ?? "9999") },
  { chave: "pendencias", rotulo: "Mais pendências", comparar: (a, b) => b.pendencias.length - a.pendencias.length || ao(a.nome, b.nome) },
];

function linhaImovel(l: LinhaImovel) {
  const piorCritico = l.pendencias.some((p) => p.nivel === "critico");
  const v = l.vigencia;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[0.875rem] font-medium text-cataguases-marinho">{l.nome}</p>
        <p className="truncate text-xs text-slate-600">
          {VINCULO[l.vinculo]} · {l.secretaria} · {l.endereco}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Selo tom={l.situacao === "ativo" ? "verde" : l.situacao === "em_entrega" ? "ambar" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
          {v.nivel === "vencido" && <Selo tom="vermelho">Contrato vencido</Selo>}
          {(v.nivel === "critico" || v.nivel === "atencao") && v.dias !== null && <SeloDias dias={v.dias} nivel={v.nivel} />}
          {l.pendencias.length > 0 && <SeloNivel nivel={piorCritico ? "critico" : "atencao"}>{um(l.pendencias.length, "pendência", "pendências")}</SeloNivel>}
        </div>
      </div>
      <div className="flex-none text-right">
        <span className="block whitespace-nowrap text-[0.875rem] font-semibold tabular-nums text-cataguases-marinho">{l.aluguel ? brl(l.aluguel) : "—"}</span>
        <span className="block text-xs text-slate-500">{l.agua + l.luz ? `${brlCurto(l.agua + l.luz)} água e luz` : "sem contas no mês"}</span>
      </div>
    </div>
  );
}

function resumoImovel(l: LinhaImovel) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={l.situacao === "ativo" ? "verde" : l.situacao === "em_entrega" ? "ambar" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
        <Selo tom="azul">{VINCULO[l.vinculo]}</Selo>
        {l.vigencia.nivel !== "ok" && l.vigencia.nivel !== "sem_fim" && l.vigencia.nivel !== "entregue" && <Selo tom={l.vigencia.nivel === "atencao" ? "ambar" : "vermelho"}>{l.vigencia.texto}</Selo>}
      </div>
      <Numeros
        itens={[
          { rotulo: "Aluguel", valor: l.aluguel ? brl(l.aluguel) : "—", apoio: l.diaVencimento ? `vence dia ${l.diaVencimento}` : undefined },
          { rotulo: `Água e luz · ${rotuloMes(l.referencia)}`, valor: l.agua + l.luz ? brl(l.agua + l.luz) : "—", apoio: l.agua + l.luz ? `água ${brlCurto(l.agua)} · luz ${brlCurto(l.luz)}` : undefined },
        ]}
      />
      {l.pendencias.length > 0 && (
        <Bloco titulo="Pendências">
          <ul className="flex flex-col gap-2">
            {l.pendencias.map((p) => (
              <li key={`${p.titulo}-${p.detalhe}`} className={cn("rounded-lg border border-slate-200 border-l-4 px-3 py-2 text-[0.8125rem]", p.nivel === "critico" ? "border-l-red-600" : "border-l-amber-500")}>
                <p className="font-medium text-cataguases-marinho">{p.titulo}</p>
                <p className="text-slate-600">{p.detalhe}</p>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
      <Bloco titulo="Contrato">
        <Campos
          itens={[
            ["Contrato", l.contrato],
            ["Vigência", l.vigenciaInicio || l.vigenciaFim ? `${formatarData(l.vigenciaInicio)} a ${formatarData(l.vigenciaFim)}` : null],
            ["Imobiliária", l.imobiliaria],
            ["Reajuste", l.indice ? `${l.indice}${l.proximoReajuste ? ` · ${formatarData(l.proximoReajuste)}` : ""}` : null],
            ["Proprietário", l.proprietario],
            ["CPF / CNPJ", l.documento],
          ]}
        />
      </Bloco>
      <Bloco titulo="Local">
        <Campos itens={[["Secretaria", l.secretaria], ["Setor", l.setor], ["Endereço", l.endereco], ["Finalidade", l.finalidade]]} />
      </Bloco>
      <Bloco titulo={`Unidades de consumo (${l.unidades.length})`}>
        {l.unidades.length === 0 ? (
          <p className="text-[0.8125rem] text-slate-600">Nenhuma unidade de água ou luz cadastrada.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {l.unidades.map((u) => (
              <li key={`${u.tipo}-${u.numero}`} className={cn("rounded-full border px-2.5 py-0.5 text-xs", u.ativa ? "border-slate-300 text-slate-700" : "border-slate-200 text-slate-400 line-through")}>
                {u.tipo === "luz" ? "Luz" : "Água"} · {u.numero}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </div>
  );
}

const COLUNAS_AREAIMOVEIS: ColunaCsv<LinhaImovel>[] = [
  { titulo: "Imóvel", valor: (l) => l.nome },
  { titulo: "Endereço", valor: (l) => l.endereco },
  { titulo: "Secretaria", valor: (l) => l.secretaria },
  { titulo: "Setor", valor: (l) => l.setor },
  { titulo: "Finalidade", valor: (l) => l.finalidade },
  { titulo: "Situação", valor: (l) => l.situacao },
  { titulo: "Vínculo", valor: (l) => l.vinculo },
  { titulo: "Imobiliária", valor: (l) => l.imobiliaria },
  { titulo: "Contrato", valor: (l) => l.contrato },
  { titulo: "Vigência início", valor: (l) => l.vigenciaInicio },
  { titulo: "Vigência fim", valor: (l) => l.vigenciaFim },
  { titulo: "Vigência", valor: (l) => l.vigencia.texto },
  { titulo: "Aluguel (R$)", valor: (l) => l.aluguel },
  { titulo: "Dia de vencimento", valor: (l) => l.diaVencimento },
  { titulo: "Índice de reajuste", valor: (l) => l.indice },
  { titulo: "Próximo reajuste", valor: (l) => l.proximoReajuste },
  { titulo: "Proprietário", valor: (l) => l.proprietario },
  { titulo: "Documento", valor: (l) => l.documento },
  { titulo: "Água (R$, mês de referência)", valor: (l) => l.agua },
  { titulo: "Luz (R$, mês de referência)", valor: (l) => l.luz },
];
export function AreaImoveis({ linhas, gestor }: { linhas: LinhaImovel[]; gestor: boolean }) {
  const ref = linhas[0]?.referencia;
  return (
    <AreaTrabalhoLista
      chave="imoveis-imoveis"
      titulo="Imóveis"
      unidades={{ singular: "imóvel", plural: "imóveis" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dimsImoveis}
      medidas={medidasImoveis}
      graficos={["situacao", "secretaria"]}
      textoBusca={(l) => `${l.nome} ${l.endereco} ${l.contrato ?? ""} ${l.proprietario ?? ""} ${l.setor ?? ""} ${l.secretaria} ${l.imobiliaria ?? ""} ${l.pendencias.map((p) => `${p.titulo} ${p.detalhe}`).join(" ")}`}
      placeholderBusca="Nome, endereço, contrato ou proprietário"
      ordens={ordensImoveis}
      kpis={(f) => [
        { rotulo: "Imóveis", valor: String(f.length) },
        { rotulo: "Aluguel", valor: brlCurto(f.reduce((s, l) => s + l.aluguel, 0)), apoio: "por mês" },
        { rotulo: `Água e luz${ref ? ` · ${rotuloMes(ref)}` : ""}`, valor: brlCurto(f.reduce((s, l) => s + l.agua + l.luz, 0)) },
        { rotulo: "Com pendência", valor: String(f.filter((l) => l.pendencias.length > 0).length) },
      ]}
      renderLinha={linhaImovel}
      corLinha={(l) => (l.pendencias.some((p) => p.nivel === "critico") ? "#B91C1C" : l.pendencias.length ? "#D97706" : COR_SITUACAO[l.situacao])}
      renderResumo={resumoImovel}
      tituloResumo={(l) => l.nome}
      subtituloResumo={(l) => l.secretaria}
      hrefPagina={(l) => `/imoveis/imoveis/${l.id}`}
      rotuloPagina={gestor ? "Abrir e editar" : "Abrir"}
      vazio="Nenhum imóvel cadastrado ainda."
      exportar={{ arquivo: "imoveis", colunas: COLUNAS_AREAIMOVEIS }}
      acoes={
        <>
          <MenuExportarImoveis relatorios={[{ r: "imoveis", rotulo: "Imóveis" }, { r: "secretarias", rotulo: "Gasto por secretaria" }]} />
          {gestor && (
            <Link href="/imoveis/imoveis/novo" className={CLASSE_BOTAO}>
              Novo imóvel
            </Link>
          )}
        </>
      }
    />
  );
}

// =====================================================================================================================
// Pendências
// =====================================================================================================================

const NIVEL_ROTULO = { critico: "Crítico", atencao: "Atenção" } as const;

const dimsPendencias: Dimensao<LinhaPendencia>[] = [
  { chave: "gravidade", rotulo: "Gravidade", param: "g", valores: (l) => [{ chave: l.nivel, rotulo: NIVEL_ROTULO[l.nivel], cor: COR_GRAVIDADE[l.nivel] }], ordem: ["critico", "atencao"] },
  { chave: "assunto", rotulo: "Assunto", param: "a", valores: (l) => [{ chave: l.assunto, rotulo: ROTULO_ASSUNTO[l.assunto] }] },
  { chave: "secretaria", rotulo: "Secretaria", param: "s", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
  {
    chave: "situacao", rotulo: "Situação", param: "j",
    valores: (l) => [l.justificada ? { chave: "justificada", rotulo: "Justificadas", cor: "#94A3B8" } : { chave: "aberta", rotulo: "Em aberto", cor: "#D97706" }],
    aliases: { "1": [] },
    rotulosAlias: { "1": "Abertas e justificadas" },
    padrao: "aberta",
    ordem: ["aberta", "justificada"],
  },
  { chave: "imovel", rotulo: "Imóvel", param: "im", valores: (l) => [{ chave: l.imovelId, rotulo: l.imovel }] },
];
const ordensPendencias: OrdemLista<LinhaPendencia>[] = [
  { chave: "gravidade", rotulo: "Mais graves primeiro", comparar: (a, b) => Number(b.nivel === "critico") - Number(a.nivel === "critico") || ao(a.imovel, b.imovel) },
  { chave: "imovel", rotulo: "Imóvel (A–Z)", comparar: (a, b) => ao(a.imovel, b.imovel) || ao(a.titulo, b.titulo) },
  { chave: "assunto", rotulo: "Assunto", comparar: (a, b) => ao(ROTULO_ASSUNTO[a.assunto], ROTULO_ASSUNTO[b.assunto]) || ao(a.imovel, b.imovel) },
];

function linhaPendencia(l: LinhaPendencia) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="line-clamp-2 text-[0.875rem] font-medium leading-snug text-cataguases-marinho">
          {l.imovel} <span className="font-normal text-slate-600">· {l.titulo}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{l.detalhe}</p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {l.secretaria} · {ROTULO_ASSUNTO[l.assunto]}
        </p>
      </div>
      <div className="flex-none">{l.justificada ? <Selo>Justificada</Selo> : <SeloNivel nivel={l.nivel}>{NIVEL_ROTULO[l.nivel]}</SeloNivel>}</div>
    </div>
  );
}

function resumoPendencia(l: LinhaPendencia, gestor: boolean) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {l.justificada ? <Selo>Justificada</Selo> : <SeloNivel nivel={l.nivel}>{NIVEL_ROTULO[l.nivel]}</SeloNivel>}
        <Selo tom="azul">{ROTULO_ASSUNTO[l.assunto]}</Selo>
      </div>
      <p className="text-[0.875rem] leading-snug text-slate-800">{l.detalhe}</p>
      <Bloco>
        <Campos itens={[["Imóvel", l.imovel], ["Secretaria", l.secretaria]]} />
      </Bloco>
      {l.justificada && (
        <Bloco titulo="Justificativa">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[0.8125rem] text-slate-700">
            <strong className="font-semibold">Em {formatarData(l.justificada.em)}:</strong> {l.justificada.texto}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">A justificativa vale enquanto o dado que gerou a pendência não mudar.</p>
        </Bloco>
      )}
      {gestor && (
        <Bloco titulo={l.justificada ? "Justificativa" : "Justificar"}>
          <BotaoJustificar imovelId={l.imovelId} chave={l.chave} assinatura={l.assinatura} justificada={!!l.justificada} />
        </Bloco>
      )}
    </div>
  );
}

const COLUNAS_AREAPENDENCIAS: ColunaCsv<LinhaPendencia>[] = [
  { titulo: "Imóvel", valor: (l) => l.imovel },
  { titulo: "Secretaria", valor: (l) => l.secretaria },
  { titulo: "Pendência", valor: (l) => l.titulo },
  { titulo: "Assunto", valor: (l) => l.assunto },
  { titulo: "Nível", valor: (l) => (l.nivel === "critico" ? "Crítico" : "Atenção") },
  { titulo: "Detalhe", valor: (l) => l.detalhe },
  { titulo: "Justificada em", valor: (l) => l.justificada?.em },
  { titulo: "Justificativa", valor: (l) => l.justificada?.texto },
];
export function AreaPendencias({ linhas, gestor }: { linhas: LinhaPendencia[]; gestor: boolean }) {
  return (
    <AreaTrabalhoLista
      chave="imoveis-pendencias"
      titulo="Pendências"
      unidades={{ singular: "pendência", plural: "pendências" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dimsPendencias}
      medidas={[]}
      graficos={["gravidade", "assunto"]}
      textoBusca={(l) => `${l.imovel} ${l.titulo} ${l.detalhe} ${l.secretaria}`}
      placeholderBusca="Imóvel ou assunto"
      ordens={ordensPendencias}
      kpis={(f) => [
        { rotulo: "Pendências", valor: String(f.length) },
        { rotulo: "Críticas", valor: String(f.filter((l) => l.nivel === "critico" && !l.justificada).length) },
        { rotulo: "Imóveis", valor: String(new Set(f.map((l) => l.imovelId)).size), apoio: "com pendência" },
      ]}
      renderLinha={linhaPendencia}
      corLinha={(l) => (l.justificada ? "#CBD5E1" : COR_GRAVIDADE[l.nivel])}
      renderResumo={(l) => resumoPendencia(l, gestor)}
      tituloResumo={(l) => l.titulo}
      subtituloResumo={(l) => l.imovel}
      hrefPagina={(l) => `/imoveis/imoveis/${l.imovelId}`}
      rotuloPagina="Abrir imóvel"
      vazio="Nenhuma pendência. Tudo em ordem."
      exportar={{ arquivo: "pendencias-imoveis", colunas: COLUNAS_AREAPENDENCIAS }}
      acoes={<MenuExportarImoveis relatorios={[{ r: "pendencias", rotulo: "Pendências" }]} />}
    />
  );
}

// =====================================================================================================================
// Entregas
// =====================================================================================================================

const dimsEntregas: Dimensao<LinhaEntrega>[] = [
  { chave: "situacao", rotulo: "Situação", param: "sit", valores: (l) => [{ chave: l.situacao, rotulo: SITUACAO[l.situacao], cor: COR_SITUACAO[l.situacao] }], ordem: ["em_entrega", "ativo", "entregue"] },
  { chave: "etapa", rotulo: "Próxima etapa", param: "etapa", valores: (l) => [{ chave: l.proxima, rotulo: l.proxima }] },
  { chave: "alerta", rotulo: "Alerta", param: "alerta", valores: (l) => [l.alerta || l.critica ? { chave: "1", rotulo: "Pede atenção", cor: "#B91C1C" } : { chave: "0", rotulo: "Sem alerta", cor: "#059669" }], ordem: ["1", "0"] },
  { chave: "secretaria", rotulo: "Secretaria", param: "sec", valores: (l) => [{ chave: l.secretariaId, rotulo: l.secretaria }] },
];
const ordensEntregas: OrdemLista<LinhaEntrega>[] = [
  { chave: "andamento", rotulo: "Em andamento primeiro", comparar: (a, b) => Number(a.situacao === "entregue") - Number(b.situacao === "entregue") || Number(b.alerta) - Number(a.alerta) || a.feitas - b.feitas || ao(a.nome, b.nome) },
  { chave: "nome", rotulo: "Nome (A–Z)", comparar: (a, b) => ao(a.nome, b.nome) },
  { chave: "aviso", rotulo: "Aviso mais antigo", comparar: (a, b) => (b.diasDesdeAviso ?? -1) - (a.diasDesdeAviso ?? -1) },
];

function linhaEntrega(l: LinhaEntrega) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[0.875rem] font-medium text-cataguases-marinho">
          {l.nome} <span className="font-normal text-slate-600">· {l.secretaria}</span>
        </p>
        <span className={cn("flex-none text-xs font-semibold tabular-nums", l.alerta ? "text-red-700" : "text-slate-600")}>
          {l.feitas}/{l.total}
        </span>
      </div>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: l.total }, (_, k) => (
          <i key={k} className={cn("h-1.5 flex-1 rounded-full", k < l.feitas ? "bg-emerald-500" : k === l.feitas ? (l.alerta ? "bg-red-500" : "bg-[color:var(--modulo)]") : "bg-slate-200")} />
        ))}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={l.situacao === "em_entrega" ? "ambar" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
        {l.critica && <SeloNivel nivel="critico">Crítico</SeloNivel>}
        <span className={cn("truncate text-xs", l.alerta ? "text-red-700" : "text-slate-600")}>
          {l.proxima === "Concluída" ? "Todas as etapas concluídas" : l.proxima === "Etapas não registradas" ? "Etapas não registradas" : `${l.alerta ? "Atenção" : "Próxima"}: ${l.proxima}`}
        </span>
      </div>
    </div>
  );
}

function resumoEntrega(l: LinhaEntrega) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={l.situacao === "em_entrega" ? "ambar" : "neutro"}>{SITUACAO[l.situacao]}</Selo>
        {l.critica && <SeloNivel nivel="critico">Crítico</SeloNivel>}
      </div>
      <Numeros itens={[{ rotulo: "Etapas feitas", valor: `${l.feitas} de ${l.total}` }, { rotulo: "Desde o aviso de saída", valor: l.diasDesdeAviso !== null ? um(l.diasDesdeAviso, "dia", "dias") : "—" }]} />
      <Bloco titulo="Etapas da entrega">
        <Passos
          passos={l.etapas.map((e) => ({
            nome: e.nome,
            estado: e.estado === "feita" ? "feito" : e.estado === "agora" || e.estado === "alerta" ? "atual" : "futuro",
            detalhe: [e.data ? formatarData(e.data) : e.estado === "alerta" ? "precisa ser resolvida" : null, e.detalhe].filter(Boolean).join(" · ") || undefined,
          }))}
        />
      </Bloco>
      <Bloco>
        <Campos itens={[["Secretaria", l.secretaria], ["Endereço", l.endereco], ["Contrato", l.contrato], ["Vigência até", l.vigenciaFim ? formatarData(l.vigenciaFim) : null]]} />
      </Bloco>
    </div>
  );
}

const COLUNAS_AREAENTREGAS: ColunaCsv<LinhaEntrega>[] = [
  { titulo: "Imóvel", valor: (l) => l.nome },
  { titulo: "Endereço", valor: (l) => l.endereco },
  { titulo: "Secretaria", valor: (l) => l.secretaria },
  { titulo: "Situação", valor: (l) => l.situacao },
  { titulo: "Contrato", valor: (l) => l.contrato },
  { titulo: "Vigência fim", valor: (l) => l.vigenciaFim },
  { titulo: "Etapas feitas", valor: (l) => l.feitas },
  { titulo: "Total de etapas", valor: (l) => l.total },
  { titulo: "Próxima etapa", valor: (l) => l.proxima },
  { titulo: "Em alerta", valor: (l) => l.alerta },
];
export function AreaEntregas({ linhas, gestor }: { linhas: LinhaEntrega[]; gestor: boolean }) {
  return (
    <AreaTrabalhoLista
      chave="imoveis-entregas"
      titulo="Entregas de imóveis"
      unidades={{ singular: "entrega", plural: "entregas" }}
      itens={linhas}
      id={(l) => l.id}
      dims={dimsEntregas}
      medidas={[]}
      graficos={["etapa", "situacao"]}
      textoBusca={(l) => `${l.nome} ${l.endereco} ${l.secretaria} ${l.contrato ?? ""}`}
      placeholderBusca="Imóvel, endereço ou secretaria"
      ordens={ordensEntregas}
      kpis={(f) => [
        { rotulo: "Entregas", valor: String(f.length) },
        { rotulo: "Em andamento", valor: String(f.filter((l) => l.situacao !== "entregue").length) },
        { rotulo: "Pedem atenção", valor: String(f.filter((l) => l.alerta || l.critica).length) },
      ]}
      renderLinha={linhaEntrega}
      corLinha={(l) => (l.alerta || l.critica ? "#B91C1C" : COR_SITUACAO[l.situacao])}
      renderResumo={resumoEntrega}
      tituloResumo={(l) => l.nome}
      subtituloResumo={(l) => l.secretaria}
      hrefPagina={(l) => `/imoveis/imoveis/${l.id}?aba=entrega`}
      rotuloPagina={gestor ? "Abrir e editar" : "Abrir"}
      vazio="Nenhuma entrega em andamento. Para iniciar, abra o imóvel e use a aba “Entrega”."
      exportar={{ arquivo: "entregas-imoveis", colunas: COLUNAS_AREAENTREGAS }}
    />
  );
}
