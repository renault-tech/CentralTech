"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";

import { BaseLegalLinha } from "@/components/emendas/base-legal";
import { BOTAO, CAMPO, Erro, Secao, useSalvar } from "@/components/emendas/config/editores";
import { registrarImpedimentosEmLote, removerParecer, salvarDatasExercicio, salvarParecer } from "@/lib/emendas/actions-config";
import { brl, dataBr } from "@/lib/emendas/regras";
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
      <BaseLegalLinha chave="exequibilidade" className="mt-1" />
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
  emendasDaSecretaria,
}: {
  ano: number;
  anos: number[];
  prazo: string | null;
  secretarias: Secretaria[];
  pareceres: ParecerExequibilidade[];
  emendasPorSecretaria: Record<string, number>;
  emendasDaSecretaria: Record<string, EmendaDaSecretaria[]>;
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
          <LinhaParecer key={s.id} ano={ano} secretaria={s} parecer={porSecretaria.get(s.id)} emendas={emendasPorSecretaria[s.id] ?? 0} lista={emendasDaSecretaria[s.id] ?? []} vencido={!!prazo && prazo < hoje} />
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
  lista,
  vencido,
}: {
  ano: number;
  secretaria: Secretaria;
  parecer?: ParecerExequibilidade;
  emendas: number;
  lista: EmendaDaSecretaria[];
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
      {parecer && lista.length > 0 && <ImpedimentosEmLote ano={ano} secretariaId={secretaria.id} protocolo={parecer.protocolo} lista={lista} />}
    </li>
  );
}

export type EmendaDaSecretaria = { id: string; numero: number; objeto: string; valor: number; impedida: boolean };

/** Marca as emendas que o parecer diz não serem exequíveis e registra o impedimento técnico de uma vez. */
function ImpedimentosEmLote({ ano, secretariaId, protocolo, lista }: { ano: number; secretariaId: string; protocolo: string | null; lista: EmendaDaSecretaria[] }) {
  const [aberto, setAberto] = React.useState(false);
  const [marcadas, setMarcadas] = React.useState<Set<string>>(new Set());
  const [justificativa, setJustificativa] = React.useState(protocolo ? `Inexequível conforme parecer da secretaria (protocolo ${protocolo}).` : "Inexequível conforme parecer da secretaria.");
  const [msg, setMsg] = React.useState<string | null>(null);
  const { erro, salvando, salvar } = useSalvar();
  const livres = lista.filter((e) => !e.impedida);

  function alternar(id: string) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="mt-2">
      <button type="button" className="text-xs font-medium text-[#5B3FA8] hover:underline" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? "Fechar" : "Marcar emendas não exequíveis"}
      </button>
      {aberto && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-[13px]">
            {lista.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#6B4FBB]"
                  checked={marcadas.has(e.id)}
                  disabled={e.impedida || salvando}
                  onChange={() => alternar(e.id)}
                  aria-label={`Emenda ${e.numero} não exequível`}
                />
                <span className={e.impedida ? "text-slate-400" : "text-slate-800"}>
                  <span className="font-mono text-xs">nº {e.numero}</span> · {e.objeto} · {brl(e.valor)}
                  {e.impedida && " (já impedida)"}
                </span>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Justificativa do impedimento
            <textarea className={CAMPO} rows={2} maxLength={2000} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BOTAO} disabled={salvando || marcadas.size === 0} onClick={() => setMarcadas(new Set())}>
              Limpar
            </button>
            <button
              type="button"
              className={BOTAO}
              disabled={salvando || marcadas.size === 0}
              onClick={() => {
                setMsg(null);
                void salvar(async () => {
                  const r = await registrarImpedimentosEmLote({ ano, secretariaId, emendaIds: Array.from(marcadas), justificativa });
                  if (r.sucesso) {
                    setMsg(`${r.criados ?? 0} impedimento(s) registrado(s)${r.jaImpedidas ? `; ${r.jaImpedidas} já tinha(m) impedimento` : ""}.`);
                    setMarcadas(new Set());
                  }
                  return r;
                });
              }}
            >
              Registrar impedimento em {marcadas.size} emenda(s)
            </button>
            {livres.length === 0 && <span className="text-xs text-slate-500">Todas as emendas já estão impedidas.</span>}
          </div>
          {msg && <p className="text-sm text-green-700" role="status">{msg}</p>}
          <Erro texto={erro} />
        </div>
      )}
    </div>
  );
}
