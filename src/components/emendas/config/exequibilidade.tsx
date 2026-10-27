"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";

import { BOTAO, CAMPO, Erro, Secao, useSalvar } from "@/components/emendas/config/editores";
import { removerParecer, salvarDatasExercicio, salvarParecer } from "@/lib/emendas/actions-config";
import { dataBr } from "@/lib/emendas/regras";
import type { Exercicio, ParecerExequibilidade, Secretaria } from "@/types/emendas";

/** Datas do ano, preenchidas uma vez: valem para todas as emendas. */
export function EditorDatasExercicio({ exercicio }: { exercicio: Exercicio }) {
  const [loa, setLoa] = React.useState(exercicio.data_aprovacao_loa ?? "");
  const [lei, setLei] = React.useState(exercicio.numero_lei_loa ?? "");
  const [prazo, setPrazo] = React.useState(exercicio.prazo_exequibilidade ?? "");
  const { erro, salvando, salvar } = useSalvar();
  const [salvo, setSalvo] = React.useState(false);

  return (
    <Secao
      titulo={`Datas de ${exercicio.ano}`}
      apoio="Preenchidas uma vez, valem para todas as emendas do ano: a fase “Indicada na LOA” e o alerta de prazo de exequibilidade saem daqui."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Aprovação da LOA
          <input type="date" className={CAMPO} value={loa} onChange={(e) => { setLoa(e.target.value); setSalvo(false); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Lei da LOA (número)
          <input className={CAMPO} value={lei} maxLength={60} placeholder="Ex.: Lei nº 4.500/2025" onChange={(e) => { setLei(e.target.value); setSalvo(false); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Prazo de exequibilidade técnica
          <input type="date" className={CAMPO} value={prazo} onChange={(e) => { setPrazo(e.target.value); setSalvo(false); }} />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        O prazo de exequibilidade é a data limite para cada secretaria informar se as emendas dela podem ser cumpridas.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className={BOTAO}
          disabled={salvando}
          onClick={() =>
            void salvar(
              () => salvarDatasExercicio({ ano: exercicio.ano, dataLoa: loa || null, numeroLei: lei, prazoExequibilidade: prazo || null }),
              () => setSalvo(true)
            )
          }
        >
          {salvando ? "Salvando…" : "Salvar datas"}
        </button>
        {salvo && (
          <span className="inline-flex items-center gap-1 text-sm text-green-700">
            <Check className="h-4 w-4" aria-hidden /> Salvo
          </span>
        )}
      </div>
      <Erro texto={erro} />
    </Secao>
  );
}

/** Parecer de exequibilidade: um por secretaria e ano. */
export function EditorPareceres({
  ano,
  anos,
  prazo,
  secretarias,
  pareceres,
  emendasPorSecretaria,
}: {
  ano: number;
  anos: number[];
  prazo: string | null;
  secretarias: Secretaria[];
  pareceres: ParecerExequibilidade[];
  emendasPorSecretaria: Record<string, number>;
}) {
  const router = useRouter();
  const porSecretaria = new Map(pareceres.map((p) => [p.secretaria_id, p]));
  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Secao
      titulo="Parecer de exequibilidade por secretaria"
      apoio="Cada secretaria informa se as emendas dela podem ser cumpridas. O parecer vale para todas as emendas dela no ano; exceções são registradas como impedimento na própria emenda."
    >
      <label className="mb-3 flex max-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
        Exercício
        <select className={CAMPO} value={ano} onChange={(e) => router.push(`/emendas/configuracoes/exequibilidade?ano=${e.target.value}`)}>
          {anos.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      {prazo && (
        <p className="mb-3 text-[13px] text-slate-600">
          Prazo: <strong>{dataBr(prazo)}</strong>
          {prazo < hoje && " (vencido)"}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {secretarias.map((s) => (
          <LinhaParecer key={s.id} ano={ano} secretaria={s} parecer={porSecretaria.get(s.id)} emendas={emendasPorSecretaria[s.id] ?? 0} vencido={!!prazo && prazo < hoje} />
        ))}
      </ul>
    </Secao>
  );
}

function LinhaParecer({
  ano,
  secretaria,
  parecer,
  emendas,
  vencido,
}: {
  ano: number;
  secretaria: Secretaria;
  parecer?: ParecerExequibilidade;
  emendas: number;
  vencido: boolean;
}) {
  const [data, setData] = React.useState(parecer?.data ?? "");
  const [protocolo, setProtocolo] = React.useState(parecer?.protocolo ?? "");
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-medium text-cataguases-marinho">{secretaria.nome}</p>
          <p className="text-xs text-slate-500">
            {emendas} emenda{emendas === 1 ? "" : "s"} ·{" "}
            {parecer ? <span className="text-green-700">parecer em {dataBr(parecer.data)}</span> : <span className={vencido ? "text-red-700" : ""}>sem parecer</span>}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Data do parecer
          <input type="date" className={CAMPO} value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Protocolo
          <input className={CAMPO} value={protocolo} maxLength={80} onChange={(e) => setProtocolo(e.target.value)} />
        </label>
        <button type="button" className={BOTAO} disabled={salvando || !data} onClick={() => void salvar(() => salvarParecer({ ano, secretariaId: secretaria.id, data, protocolo }))}>
          Salvar
        </button>
        {parecer && (
          <button
            type="button"
            aria-label={`Remover parecer de ${secretaria.nome}`}
            className="rounded p-2 text-slate-500 hover:bg-slate-100"
            disabled={salvando}
            onClick={() => void salvar(() => removerParecer(ano, secretaria.id), () => { setData(""); setProtocolo(""); })}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <Erro texto={erro} />
    </li>
  );
}
