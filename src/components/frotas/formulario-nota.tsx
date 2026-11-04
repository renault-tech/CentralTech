"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { excluirNota, salvarNota } from "@/lib/frotas/actions";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_PERIGO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { Fornecedor, NotaCombustivel, SecretariaFrotas } from "@/types/frotas";

type OpcaoQuinzena = { inicio: string; rotulo: string };

/** Lançamento e andamento de uma NF de combustível (por secretaria, a cada quinzena). */
export function FormularioNota({
  nota,
  secretarias,
  postos,
  quinzenas,
  dataHoje,
  voltarPara,
}: {
  nota: NotaCombustivel | null;
  secretarias: SecretariaFrotas[];
  postos: Fornecedor[];
  quinzenas: OpcaoQuinzena[];
  dataHoje: string;
  voltarPara: string;
}) {
  const router = useRouter();
  const [secretariaId, setSecretariaId] = React.useState(nota?.secretaria_id ?? "");
  const [numeroNf, setNumeroNf] = React.useState(nota?.numero_nf ?? "");
  const [postoId, setPostoId] = React.useState(nota?.fornecedor_id ?? "");
  const [quinzena, setQuinzena] = React.useState(nota?.periodo_inicio ?? quinzenas[0]?.inicio ?? "");
  const [emissao, setEmissao] = React.useState(nota?.data_emissao ?? dataHoje);
  const [valor, setValor] = React.useState(valorParaCampo(nota?.valor));
  const [enviada, setEnviada] = React.useState(nota?.enviada_secretaria_em ?? "");
  const [retornou, setRetornou] = React.useState(nota?.retornou_em ?? "");
  const [contabilidade, setContabilidade] = React.useState(nota?.enviada_contabilidade_em ?? "");
  const [observacoes, setObservacoes] = React.useState(nota?.observacoes ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const v = lerValor(valor);
    if (v === null || Number.isNaN(v)) return setErro("Informe o valor da NF (ex.: 48.312,70).");
    iniciar(async () => {
      const r = await salvarNota({
        id: nota?.id,
        secretariaId,
        fornecedorId: postoId || null,
        numeroNf,
        quinzena,
        dataEmissao: emissao,
        valor: v,
        enviadaSecretariaEm: enviada || null,
        retornouEm: retornou || null,
        enviadaContabilidadeEm: contabilidade || null,
        observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      if (r.aviso) return setAviso(r.aviso);
      router.replace(voltarPara);
    });
  }

  function excluir() {
    if (!nota || !window.confirm(`Excluir a NF ${nota.numero_nf}? O histórico da alteração fica registrado.`)) return;
    iniciar(async () => {
      const r = await excluirNota(nota.id);
      if (!r.sucesso) return setErro(r.erro);
      router.replace(voltarPara);
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3.5">
      <Campo rotulo="Secretaria" htmlFor="nf-sec">
        <select id="nf-sec" required value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
          <option value="">Escolha…</option>
          {secretarias.filter((s) => s.ativa || s.id === secretariaId).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Número da NF" htmlFor="nf-num">
          <input id="nf-num" required value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={40} />
        </Campo>
        <Campo rotulo="Posto" htmlFor="nf-posto" dica={postos.length === 0 ? "Cadastre os postos em Configurações." : undefined}>
          <select id="nf-posto" value={postoId} onChange={(e) => setPostoId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Não informado</option>
            {postos.filter((p) => p.ativo || p.id === postoId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Quinzena" htmlFor="nf-quinz">
          <select id="nf-quinz" required value={quinzena} onChange={(e) => setQuinzena(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            {quinzenas.map((q) => (
              <option key={q.inicio} value={q.inicio}>
                {q.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Data de emissão" htmlFor="nf-emissao">
          <input id="nf-emissao" type="date" required value={emissao} onChange={(e) => setEmissao(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
      </div>
      <Campo rotulo="Valor da NF" htmlFor="nf-valor">
        <input id="nf-valor" required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} />
      </Campo>

      <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-3.5">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Andamento do documento</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Enviada à secretaria" htmlFor="nf-env">
            <input id="nf-env" type="date" value={enviada} onChange={(e) => setEnviada(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
          </Campo>
          <Campo rotulo="Retornou assinada" htmlFor="nf-ret">
            <input id="nf-ret" type="date" value={retornou} onChange={(e) => setRetornou(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
          </Campo>
        </div>
        <Campo rotulo="Enviada à Contabilidade" htmlFor="nf-ctb" dica="O sistema avisa se uma data vier antes da anterior ou se a NF já existir.">
          <input id="nf-ctb" type="date" value={contabilidade} onChange={(e) => setContabilidade(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
      </fieldset>

      <Campo rotulo="Observações" htmlFor="nf-obs">
        <textarea id="nf-obs" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} className={ESTILO_CAMPO_PADRAO} placeholder="Situações específicas deste lançamento" />
      </Campo>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {aviso && (
        <Mensagem tipo="aviso">
          Salvo. Atenção: {aviso}{" "}
          <button type="button" onClick={() => router.replace(voltarPara)} className="font-semibold underline">
            Fechar
          </button>
        </Mensagem>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => router.replace(voltarPara)} className={CLASSE_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
        {nota && (
          <button type="button" onClick={excluir} disabled={pendente} className={`${CLASSE_BOTAO_PERIGO} ml-auto`}>
            Excluir
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Cada alteração fica registrada com quem fez e quando.</p>
    </form>
  );
}
