"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { anosDoModeloFipe, aplicarFipe, buscarModelosFipe, modelosDaMarcaFipe, type BuscaFipe } from "@/lib/frotas/actions-importacao";
import type { ItemFipe } from "@/lib/frotas/fipe-parse";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { brl } from "@/lib/frotas/regras";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { TipoFipe } from "@/types/frotas";

const ROTULO_TIPO: Record<TipoFipe, string> = { carros: "Carros e utilitários", motos: "Motos", caminhoes: "Caminhões e ônibus" };

/** Vincula o veículo à tabela FIPE: acha marca e modelo parecidos, a pessoa confere e o valor do mês vai para o cadastro. */
export function BuscaFipeVeiculo({ veiculoId, tipoInicial }: { veiculoId: string; tipoInicial: TipoFipe | null }) {
  const router = useRouter();
  const [tipo, setTipo] = React.useState<TipoFipe>(tipoInicial ?? "carros");
  const [busca, setBusca] = React.useState<BuscaFipe | null>(null);
  const [marcaId, setMarcaId] = React.useState("");
  const [candidatos, setCandidatos] = React.useState<(ItemFipe & { pontos: number })[]>([]);
  const [modeloId, setModeloId] = React.useState("");
  const [anos, setAnos] = React.useState<ItemFipe[]>([]);
  const [anoId, setAnoId] = React.useState("");
  const [msg, setMsg] = React.useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function procurar() {
    setMsg(null);
    setBusca(null);
    setCandidatos([]);
    setModeloId("");
    setAnos([]);
    setAnoId("");
    iniciar(async () => {
      const r = await buscarModelosFipe({ veiculoId, tipo });
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      setBusca(r.busca);
      setMarcaId(r.busca.marca?.codigo ?? "");
      setCandidatos(r.busca.candidatos);
      if (r.busca.marca && r.busca.candidatos.length === 0) setMsg({ tipo: "erro", texto: "Nenhum modelo parecido foi achado nesta marca. Tente outro tipo de veículo." });
    });
  }

  function escolherMarca(id: string) {
    setMarcaId(id);
    setCandidatos([]);
    setModeloId("");
    setAnos([]);
    if (!id) return;
    iniciar(async () => {
      const r = await modelosDaMarcaFipe({ tipo, marcaId: id, veiculoId });
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      setCandidatos(r.candidatos);
    });
  }

  function escolherModelo(id: string) {
    setModeloId(id);
    setAnos([]);
    setAnoId("");
    if (!id) return;
    iniciar(async () => {
      const r = await anosDoModeloFipe({ tipo, marcaId, modeloId: id, veiculoId });
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      setAnos(r.anos);
      setAnoId(r.sugerido ?? "");
    });
  }

  function usar() {
    setMsg(null);
    iniciar(async () => {
      const r = await aplicarFipe({ veiculoId, tipo, marcaId, modeloId, anoId });
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: `Valor da FIPE gravado: ${brl(r.valor)} (${r.referencia}).` });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[13px] font-semibold text-slate-700">Buscar o valor na tabela FIPE</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Tipo de veículo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFipe)} className={ESTILO_CAMPO_PADRAO}>
            {(Object.keys(ROTULO_TIPO) as TipoFipe[]).map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={pendente} onClick={procurar} className={CLASSE_BOTAO_SECUNDARIO}>
          {pendente ? "Consultando…" : "Procurar na FIPE"}
        </button>
      </div>

      {busca && !busca.marca && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          A marca não foi achada sozinha. Escolha:
          <select value={marcaId} onChange={(e) => escolherMarca(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Escolha a marca…</option>
            {busca.marcas.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {busca?.marca && <p className="text-xs text-slate-600">Marca: <strong>{busca.marca.nome}</strong></p>}

      {candidatos.length > 0 && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Modelo (os mais parecidos com o cadastro primeiro)
          <select value={modeloId} onChange={(e) => escolherModelo(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Escolha o modelo…</option>
            {candidatos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {anos.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Ano e combustível
            <select value={anoId} onChange={(e) => setAnoId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Escolha…</option>
              {anos.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={pendente || !anoId} onClick={usar} className={CLASSE_BOTAO}>
            Usar este valor
          </button>
        </div>
      )}
      {msg && <Mensagem tipo={msg.tipo}>{msg.texto}</Mensagem>}
    </div>
  );
}
