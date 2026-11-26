"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { BOTAO, CAMPO, Erro, paraNumero, Secao, useSalvar } from "@/components/emendas/config/editores";
import { salvarLimitesExercicio } from "@/lib/emendas/actions-config";
import { calcularLimites } from "@/lib/emendas/limites-exercicio";
import { brl } from "@/lib/emendas/regras";
import type { Exercicio } from "@/types/emendas";

const texto = (v: number | null | undefined, casas = 2) => (v == null ? "" : Number(v).toFixed(casas).replace(".", ","));

/**
 * Limites legais do ano: percentual do teto das emendas e percentual máximo de restos a pagar (sobre a RCL), valor
 * aprovado na lei e RCL. Tudo opcional e editável à mão; o valor aprovado também pode vir do total das emendas já
 * cadastradas (a planilha importada). As contas aparecem na hora, antes de salvar.
 */
export function EditorLimitesLegais({ exercicio, somaEmendas }: { exercicio: Exercicio; somaEmendas: number }) {
  const [rcl, setRcl] = React.useState(texto(exercicio.rcl));
  const [pTeto, setPTeto] = React.useState(texto(exercicio.percentual_rcl, 4).replace(/,?0+$/, ""));
  const [pRestos, setPRestos] = React.useState(texto(exercicio.restos_teto_pct, 4).replace(/,?0+$/, ""));
  const [restosValor, setRestosValor] = React.useState(texto(exercicio.restos_teto_valor));
  const [aprovado, setAprovado] = React.useState(texto(exercicio.aprovado_loa_valor));
  const { erro, salvando, salvar } = useSalvar();
  const [salvo, setSalvo] = React.useState(false);
  const mudou = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    f(e.target.value);
    setSalvo(false);
  };

  const limites = calcularLimites({
    rcl: paraNumero(rcl),
    percentualTeto: paraNumero(pTeto),
    percentualRestos: paraNumero(pRestos),
    restosValorManual: paraNumero(restosValor),
    aprovadoLoa: paraNumero(aprovado),
    somaEmendas,
  });

  return (
    <Secao
      titulo={`Limites legais de ${exercicio.ano}`}
      apoio="Os percentuais da lei sobre a receita corrente líquida (RCL) definem a obrigação (teto) e o máximo em restos a pagar. O valor efetivamente aprovado pela Câmara é informado à parte e pode passar do teto: é ele a base do painel das Emendas."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Teto das emendas (% da RCL)
          <input className={CAMPO} inputMode="decimal" placeholder="Ex.: 2" value={pTeto} onChange={mudou(setPTeto)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Máximo em restos a pagar (% da RCL)
          <input className={CAMPO} inputMode="decimal" placeholder="Ex.: 0,5" value={pRestos} onChange={mudou(setPRestos)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          RCL (R$) — base dos percentuais
          <input className={CAMPO} inputMode="decimal" placeholder="Ex.: RCL de 2024 do Município" value={rcl} onChange={mudou(setRcl)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Valor efetivamente aprovado pela Câmara (R$)
          <input className={CAMPO} inputMode="decimal" placeholder={`Em branco: soma das emendas (${brl(somaEmendas)}). Pode passar do teto.`} value={aprovado} onChange={mudou(setAprovado)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Restos a pagar em R$ (opcional, substitui o %)
          <input className={CAMPO} inputMode="decimal" placeholder="Só se a lei fixar um valor" value={restosValor} onChange={mudou(setRestosValor)} />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setAprovado(texto(somaEmendas));
              setSalvo(false);
            }}
          >
            Usar o total das emendas cadastradas
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[0.8125rem] sm:grid-cols-2">
        <Linha rotulo="Aprovado pela Câmara (base das contas)" valor={brl(limites.aprovadoReferencia)} apoio={limites.aprovadoOrigem === "lei" ? "informado" : "soma das emendas cadastradas"} />
        <Linha rotulo="RCL informada" valor={limites.baseRcl != null ? brl(limites.baseRcl) : "—"} apoio={limites.baseRcl == null ? "informe a RCL: sem ela o teto e o limite de restos não são calculados" : undefined} alerta={limites.baseRcl == null} />
        <Linha rotulo="Obrigação legal: teto das emendas" valor={limites.tetoValor != null ? brl(limites.tetoValor) : "—"} apoio={limites.acimaDoTeto ? `a Câmara aprovou ${brl(limites.acimaDoTeto)} acima do teto` : limites.tetoDescricao ?? undefined} alerta={!!limites.acimaDoTeto} />
        <Linha rotulo="Pode ficar em restos a pagar" valor={limites.restosTeto != null ? brl(limites.restosTeto) : "—"} apoio={limites.restosDescricao ?? "informe o % ou o valor"} />
      </dl>

      <p className="mt-2 text-xs text-slate-500">
        Para trazer as emendas do ano por planilha, use <Link href="/emendas/configuracoes/importar" className="underline underline-offset-2">Configurações › Importar</Link>; o total delas aparece acima. O número e a data da lei ficam em &ldquo;Datas&rdquo;.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className={BOTAO}
          disabled={salvando}
          onClick={() =>
            void salvar(
              () =>
                salvarLimitesExercicio({
                  ano: exercicio.ano,
                  rcl: paraNumero(rcl),
                  percentualTeto: paraNumero(pTeto),
                  percentualRestos: paraNumero(pRestos),
                  restosValor: paraNumero(restosValor),
                  aprovadoLoa: paraNumero(aprovado),
                }),
              () => setSalvo(true)
            )
          }
        >
          {salvando ? "Salvando…" : "Salvar limites"}
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

function Linha({ rotulo, valor, apoio, alerta }: { rotulo: string; valor: string; apoio?: string; alerta?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-slate-600">{rotulo}</dt>
      <dd className={alerta ? "font-semibold text-red-700" : "font-semibold text-slate-900"}>
        <span className="tabular-nums">{valor}</span>
        {apoio && <span className="ml-2 text-xs font-normal text-slate-500">{apoio}</span>}
      </dd>
    </div>
  );
}
