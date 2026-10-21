"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { salvarEmenda } from "@/lib/emendas/actions";
import { NOME_MODALIDADE, brl, cumpreSaude, modalidadePorNatureza, numeroVereador, pct } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Beneficiario, EmendaResumo, Exercicio, Modalidade, Secretaria, UnidadeOrcamentaria, Vereador } from "@/types/emendas";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";

function paraNumero(t: string): number | null {
  const limpo = t.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

/** Cadastro/correção de emenda (só gestor). Mostra, enquanto digita, o
 * saldo da cota do vereador e a parcela na Saúde — as mesmas regras que o
 * banco aplica (a cota é bloqueio; os 50% na Saúde são alerta). */
export function FormularioEmenda({
  exercicio,
  emendasDoAno,
  vereadores,
  unidades,
  secretarias,
  beneficiarios,
  emenda,
}: {
  exercicio: Exercicio;
  emendasDoAno: EmendaResumo[];
  vereadores: Vereador[];
  unidades: UnidadeOrcamentaria[];
  secretarias: Secretaria[];
  beneficiarios: Beneficiario[];
  emenda?: EmendaResumo;
}) {
  const router = useRouter();
  const proximoNumero = Math.max(0, ...emendasDoAno.map((e) => e.numero)) + 1;
  const [vereadorId, setVereadorId] = React.useState(emenda?.vereador_id ?? "");
  const proximoIdVereador = (vid: string) =>
    Math.max(0, ...emendasDoAno.filter((e) => e.vereador_id === vid).map((e) => e.numero_vereador)) + 1;

  const [numero, setNumero] = React.useState(String(emenda?.numero ?? proximoNumero));
  const [numeroVereadorStr, setNumeroVereador] = React.useState(String(emenda?.numero_vereador ?? ""));
  const [objeto, setObjeto] = React.useState(emenda?.objeto ?? "");
  const [descricao, setDescricao] = React.useState(emenda?.descricao ?? "");
  const [valor, setValor] = React.useState(emenda ? emenda.valor.toFixed(2).replace(".", ",") : "");
  const [benef, setBenef] = React.useState(emenda?.beneficiario_id ?? "");
  const [benefNovo, setBenefNovo] = React.useState("");
  const [unidadeId, setUnidadeId] = React.useState(emenda?.unidade_id ?? "");
  const [saude, setSaude] = React.useState(emenda?.saude ?? false);
  const [funcional, setFuncional] = React.useState(emenda?.funcional_programatica ?? "");
  const [natureza, setNatureza] = React.useState(emenda?.natureza_despesa ?? "");
  const [modalidadeManual, setModalidadeManual] = React.useState<Modalidade>(emenda?.modalidade ?? "direta");
  const [dotacao, setDotacao] = React.useState(emenda?.dotacao_texto ?? "");
  const [ficha, setFicha] = React.useState(emenda?.ficha ?? "");
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const modalidadeAuto = modalidadePorNatureza(natureza);
  const modalidade = modalidadeAuto ?? modalidadeManual;
  const v = paraNumero(valor) ?? 0;
  const doVereador = emendasDoAno.filter((e) => e.vereador_id === vereadorId && e.id !== emenda?.id && e.situacao !== "cancelada");
  const usado = doVereador.reduce((t, e) => t + e.valor, 0);
  const saudeUsada = doVereador.filter((e) => e.saude).reduce((t, e) => t + e.valor, 0) + (saude ? v : 0);
  const saldo = exercicio.cota_por_vereador - usado - v;
  const estoura = saldo < -0.005;
  const secretariaSaude = secretarias.find((s) => /sa[uú]de/i.test(s.nome))?.id;

  function escolherUnidade(id: string) {
    setUnidadeId(id);
    const u = unidades.find((x) => x.id === id);
    if (u && secretariaSaude && !emenda) setSaude(u.secretaria_id === secretariaSaude);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (estoura) return setErro("O valor passa da cota do vereador.");
    setEnviando(true);
    const r = await salvarEmenda({
      id: emenda?.id,
      ano: exercicio.ano,
      numero: Number(numero),
      numeroVereador: Number(numeroVereadorStr),
      vereadorId,
      objeto,
      descricao,
      valor: v,
      beneficiarioId: benef && benef !== "__novo" ? benef : null,
      beneficiarioNovo: benef === "__novo" ? benefNovo : undefined,
      unidadeId,
      saude,
      funcional,
      natureza,
      dotacaoTexto: dotacao,
      ficha,
      modalidade,
    });
    setEnviando(false);
    if (!r.sucesso) return setErro(r.erro);
    router.push(`/emendas/${r.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Nº da emenda" dica={`Exercício ${exercicio.ano}`}>
            <input required inputMode="numeric" className={CAMPO} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} />
          </Campo>
          <Campo rotulo="Vereador">
            <select
              required
              className={CAMPO}
              value={vereadorId}
              onChange={(e) => {
                setVereadorId(e.target.value);
                if (!emenda) setNumeroVereador(String(proximoIdVereador(e.target.value)));
              }}
            >
              <option value="">Escolha…</option>
              {vereadores.map((x) => (
                <option key={x.id} value={x.id}>
                  {numeroVereador(x.numero)} · {x.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="ID (nº da emenda do vereador)">
            <input required inputMode="numeric" className={CAMPO} value={numeroVereadorStr} onChange={(e) => setNumeroVereador(e.target.value.replace(/\D/g, ""))} />
          </Campo>
        </div>
        <Campo rotulo="Objeto (resumo que aparece nas listas)">
          <input required maxLength={300} className={CAMPO} value={objeto} onChange={(e) => setObjeto(e.target.value)} placeholder="Ex.: Repasse ao Hospital de Cataguases para custeio" />
        </Campo>
        <Campo rotulo="Descrição completa (texto da emenda)">
          <textarea required rows={5} maxLength={4000} className={CAMPO} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Valor (R$)">
            <input required inputMode="decimal" className={cn(CAMPO, estoura && "border-red-400")} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo rotulo="Beneficiário / destinação">
            <select className={CAMPO} value={benef} onChange={(e) => setBenef(e.target.value)}>
              <option value="">— sem beneficiário —</option>
              {beneficiarios.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
              <option value="__novo">+ Novo beneficiário…</option>
            </select>
          </Campo>
          {benef === "__novo" && (
            <Campo rotulo="Nome do novo beneficiário">
              <input required maxLength={200} className={CAMPO} value={benefNovo} onChange={(e) => setBenefNovo(e.target.value)} />
            </Campo>
          )}
          <Campo rotulo="Unidade orçamentária">
            <select required className={CAMPO} value={unidadeId} onChange={(e) => escolherUnidade(e.target.value)}>
              <option value="">Escolha…</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} - {u.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <fieldset className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Dotação</legend>
          <Campo rotulo="Funcional programática">
            <input maxLength={40} className={CAMPO} value={funcional} onChange={(e) => setFuncional(e.target.value)} placeholder="10.302.0012.2087" />
          </Campo>
          <Campo
            rotulo="Natureza da despesa"
            dica={modalidadeAuto ? `Modalidade: ${NOME_MODALIDADE[modalidadeAuto]} (pela natureza)` : "3.3.50.xx/4.4.50.xx = repasse; 3.3.90.xx/4.4.90.xx = aplicação direta"}
          >
            <input className={CAMPO} value={natureza} onChange={(e) => setNatureza(e.target.value)} placeholder="3.3.50.43" />
          </Campo>
          {!modalidadeAuto && (
            <Campo rotulo="Modalidade">
              <select className={CAMPO} value={modalidadeManual} onChange={(e) => setModalidadeManual(e.target.value as Modalidade)}>
                <option value="repasse">Repasse a entidade</option>
                <option value="direta">Aplicação direta</option>
              </select>
            </Campo>
          )}
          <Campo rotulo="Nova dotação (ficha)">
            <input maxLength={300} className={CAMPO} value={ficha} onChange={(e) => setFicha(e.target.value)} placeholder="2.087.0201 - EP02 - …" />
          </Campo>
          <div className="sm:col-span-2">
            <Campo rotulo="Dotação a acrescentar (texto completo)">
              <textarea rows={2} maxLength={1000} className={CAMPO} value={dotacao} onChange={(e) => setDotacao(e.target.value)} />
            </Campo>
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-cataguases-marinho">
          <input type="checkbox" checked={saude} onChange={(e) => setSaude(e.target.checked)} className="h-4 w-4 accent-[#6B4FBB]" />
          Conta para a Saúde (mínimo de {exercicio.percentual_saude_min}% da cota)
        </label>
        {erro && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.back()} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm text-cataguases-marinho hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={enviando || estoura} className="h-10 rounded-lg bg-[#6B4FBB] px-5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50">
            {enviando ? "Salvando…" : emenda ? "Salvar correção" : "Cadastrar emenda"}
          </button>
        </div>
      </div>

      <aside className="sticky top-4 flex flex-[1_1_280px] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-cataguases-marinho">Cota do vereador</h2>
        {!vereadorId ? (
          <p className="text-sm text-slate-500">Escolha o vereador para ver o saldo.</p>
        ) : (
          <>
            <Medidor rotulo="Já indicado" valor={usado} total={exercicio.cota_por_vereador} cor="#0C1D33" />
            <Medidor rotulo="Com esta emenda" valor={usado + v} total={exercicio.cota_por_vereador} cor={estoura ? "#DC2626" : "#6B4FBB"} />
            <p className={cn("text-sm font-medium", estoura ? "text-red-700" : "text-cataguases-marinho")}>
              {estoura ? `Passa da cota em ${brl(-saldo)}` : `Saldo depois desta: ${brl(saldo)}`}
            </p>
            <div className="border-t border-slate-100 pt-3">
              <Medidor rotulo="Na Saúde" valor={saudeUsada} total={exercicio.cota_por_vereador} cor={cumpreSaude(saudeUsada, exercicio.cota_por_vereador, exercicio.percentual_saude_min) ? "#16A34A" : "#D97706"} marca={exercicio.percentual_saude_min / 100} />
              <p className="mt-1 text-xs text-slate-500">
                {cumpreSaude(saudeUsada, exercicio.cota_por_vereador, exercicio.percentual_saude_min)
                  ? "Regra da Saúde atendida."
                  : `Faltam ${brl(exercicio.cota_por_vereador * (exercicio.percentual_saude_min / 100) - saudeUsada)} na Saúde (alerta, não bloqueia).`}
              </p>
            </div>
          </>
        )}
      </aside>
    </form>
  );
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cataguases-marinho">
      {rotulo}
      {children}
      {dica && <span className="text-xs font-normal text-slate-500">{dica}</span>}
    </label>
  );
}

function Medidor({ rotulo, valor, total, cor, marca }: { rotulo: string; valor: number; total: number; cor: string; marca?: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{rotulo}</span>
        <span className="tabular-nums">
          {brl(valor)} · {pct(valor / total)}
        </span>
      </div>
      <div className="relative mt-1 h-2.5 rounded-full bg-slate-100">
        <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, (valor / total) * 100)}%`, backgroundColor: cor }} />
        {marca !== undefined && <span className="absolute -top-1 h-[18px] w-0.5 bg-cataguases-marinho" style={{ left: `${marca * 100}%` }} aria-hidden />}
      </div>
    </div>
  );
}
