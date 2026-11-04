"use client";

import * as React from "react";
import Link from "next/link";

import { confirmarOrcamentosPdf, lerOrcamentosPdf, type LinhaPrevia } from "@/lib/frotas/actions-orcamentos-pdf";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { OpcaoVeiculo } from "@/components/frotas/formularios-manutencao";
import type { Fornecedor } from "@/types/frotas";

type Linha = {
  arquivo: string;
  veiculoId: string;
  oficinaId: string;
  servico: string;
  valor: string;
  data: string;
  avisos: string[];
  incluir: boolean;
};

function daPrevia(l: LinhaPrevia, hoje: string): Linha {
  return {
    arquivo: l.arquivo,
    veiculoId: l.veiculoId ?? "",
    oficinaId: l.oficinaId ?? "",
    servico: l.servico,
    valor: valorParaCampo(l.valor),
    data: l.data ?? hoje,
    avisos: l.avisos,
    incluir: true,
  };
}

export function ImportadorOrcamentos({ veiculos, oficinas, dataHoje }: { veiculos: OpcaoVeiculo[]; oficinas: Fornecedor[]; dataHoje: string }) {
  const [linhas, setLinhas] = React.useState<Linha[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function ler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    const form = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await lerOrcamentosPdf(form);
      if (!r.sucesso) return setErro(r.erro);
      setLinhas(r.linhas.map((l) => daPrevia(l, dataHoje)));
    });
  }

  function mudar(i: number, parte: Partial<Linha>) {
    setLinhas((atual) => atual?.map((l, j) => (j === i ? { ...l, ...parte } : l)) ?? null);
  }

  function confirmar() {
    if (!linhas) return;
    setErro(null);
    const escolhidas = linhas.map((l, i) => ({ l, i })).filter(({ l }) => l.incluir);
    const prontas = escolhidas.map(({ l }) => ({ veiculoId: l.veiculoId, oficinaId: l.oficinaId || null, servico: l.servico, valor: lerValor(l.valor) ?? Number.NaN, data: l.data }));
    if (prontas.some((p) => Number.isNaN(p.valor))) return setErro("Confira os valores (ex.: 4.850,00).");
    iniciar(async () => {
      const r = await confirmarOrcamentosPdf(prontas);
      if (!r.sucesso) return setErro(r.erro);
      const comFalha = new Set(r.falhas.map((f) => escolhidas[f.posicao].i));
      setLinhas((atual) => atual?.filter((_, i) => comFalha.has(i)).map((l) => ({ ...l, avisos: [...l.avisos, r.falhas.find((f) => escolhidas[f.posicao].l === l)?.erro ?? ""].filter(Boolean) })) ?? null);
      setResultado(`${r.criados} orçamento(s) registrado(s) para análise.${r.falhas.length ? ` ${r.falhas.length} linha(s) com problema continuam abaixo.` : ""}`);
      if (r.falhas.length === 0) setLinhas(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={ler} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-800" htmlFor="pdfs">
          PDFs dos orçamentos (até 20 por vez, 5 MB cada)
        </label>
        <input id="pdfs" name="arquivos" type="file" accept="application/pdf" multiple required className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm" />
        <div>
          <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
            {pendente && !linhas ? "Lendo…" : "Ler os PDFs"}
          </button>
        </div>
        <p className="text-xs text-slate-500">O sistema só lê o texto e propõe os campos para você conferir. Os PDFs não são guardados: ficam apenas os dados que você confirmar.</p>
      </form>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {resultado && <Mensagem tipo="ok">{resultado}</Mensagem>}

      {linhas && linhas.length > 0 && (
        <div className="flex flex-col gap-3">
          {linhas.map((l, i) => (
            <section key={`${l.arquivo}-${i}`} className={`rounded-lg border p-3.5 ${l.incluir ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-cataguases-marinho">
                  <input type="checkbox" checked={l.incluir} onChange={(e) => mudar(i, { incluir: e.target.checked })} className="size-4 accent-[color:var(--modulo-texto)]" />
                  <span className="break-all">{l.arquivo}</span>
                </label>
              </header>
              {l.avisos.map((a) => (
                <p key={a} className="mb-1 text-xs text-amber-800">⚠ {a}</p>
              ))}
              <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="flex flex-col gap-1 xl:col-span-2">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`v-${i}`}>Veículo</label>
                  <select id={`v-${i}`} value={l.veiculoId} onChange={(e) => mudar(i, { veiculoId: e.target.value })} className={ESTILO_CAMPO_PADRAO}>
                    <option value="">Escolha…</option>
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>{v.rotulo}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 xl:col-span-2">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`s-${i}`}>Serviço</label>
                  <input id={`s-${i}`} value={l.servico} maxLength={80} onChange={(e) => mudar(i, { servico: e.target.value })} className={ESTILO_CAMPO_PADRAO} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`o-${i}`}>Valor</label>
                  <input id={`o-${i}`} inputMode="decimal" value={l.valor} onChange={(e) => mudar(i, { valor: e.target.value })} className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} placeholder="0,00" />
                </div>
                <div className="flex flex-col gap-1 xl:col-span-2">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`f-${i}`}>Oficina</label>
                  <select id={`f-${i}`} value={l.oficinaId} onChange={(e) => mudar(i, { oficinaId: e.target.value })} className={ESTILO_CAMPO_PADRAO}>
                    <option value="">Não informada</option>
                    {oficinas.map((o) => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-600" htmlFor={`d-${i}`}>Recebido em</label>
                  <input id={`d-${i}`} type="date" value={l.data} onChange={(e) => mudar(i, { data: e.target.value })} className={ESTILO_CAMPO_PADRAO} />
                </div>
              </div>
            </section>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente || !linhas.some((l) => l.incluir)} onClick={confirmar} className={CLASSE_BOTAO}>
              {pendente ? "Gravando…" : `Registrar ${linhas.filter((l) => l.incluir).length} orçamento(s)`}
            </button>
            <button type="button" onClick={() => setLinhas(null)} className={CLASSE_BOTAO_SECUNDARIO}>
              Descartar
            </button>
          </div>
        </div>
      )}
      {resultado && !linhas && (
        <Link href="/frotas/manutencao" className="text-sm font-semibold text-[color:var(--modulo-texto)] underline">
          Ver as manutenções
        </Link>
      )}
    </div>
  );
}
