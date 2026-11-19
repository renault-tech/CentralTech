"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleDashed, Lock, LockOpen, Rocket } from "lucide-react";

import { BOTAO, CAMPO, Erro, Secao, useSalvar } from "@/components/emendas/config/editores";
import { abrirExercicio, fecharExercicio, reabrirExercicio } from "@/lib/emendas/actions-config";
import { cn } from "@/lib/utils";

export type DadosAssistente = {
  ano: number;
  situacao: "aberto" | "encerrado";
  anosExistentes: number[];
  parametrosCompletos: boolean;
  faltaParametro: string[];
  vereadoresAtivos: number;
  emendas: number;
  remanejadas: number;
  /** Exercício imediatamente anterior, se existir: quanto falta definir antes de fechá-lo. */
  anterior: { ano: number; situacao: "aberto" | "encerrado"; semSituacao: number; restosAPagar: number } | null;
};

type Passo = { n: number; titulo: string; ok: boolean; texto: string; href?: string; acao?: string };

/**
 * Assistente de exercício (Configurações › Exercício): mostra, passo a passo, o que falta para o exercício selecionado estar pronto
 * (parâmetros, vereadores, emendas aprovadas, ajustes pós-exequibilidade) e permite abrir um ano novo copiando o anterior e fechar o
 * anterior com a conferência do que ficou sem situação. Cada passo leva à tela onde se resolve.
 */
export function AssistenteExercicio({ dados }: { dados: DadosAssistente }) {
  const passos: Passo[] = [
    { n: 1, titulo: "Exercício criado", ok: true, texto: `O exercício ${dados.ano} existe e está ${dados.situacao === "aberto" ? "aberto" : "encerrado"}.` },
    {
      n: 2,
      titulo: "Parâmetros do ano",
      ok: dados.parametrosCompletos,
      texto: dados.parametrosCompletos ? "Cota por vereador, LOA, lei e prazo de exequibilidade preenchidos." : `Falta: ${dados.faltaParametro.join(", ")}. Preencha nos quadros abaixo.`,
    },
    {
      n: 3,
      titulo: "Vereadores",
      ok: dados.vereadoresAtivos > 0,
      texto: `${dados.vereadoresAtivos} vereador(es) ativo(s). Quem saiu ou entrou se ajusta em Vereadores (o cadastro vale para todos os anos).`,
      href: "/emendas/configuracoes/vereadores",
      acao: "Conferir vereadores",
    },
    {
      n: 4,
      titulo: "Emendas aprovadas (planilha)",
      ok: dados.emendas > 0,
      texto: dados.emendas > 0 ? `${dados.emendas} emenda(s) cadastradas em ${dados.ano}.` : `Nenhuma emenda em ${dados.ano} ainda. Importe a planilha das emendas aprovadas: a prévia confere vereadores, cota e destinações antes de gravar.`,
      href: `/emendas/configuracoes/importar?ano=${dados.ano}`,
      acao: "Importar planilha",
    },
    {
      n: 5,
      titulo: "Ajustes depois da exequibilidade",
      ok: dados.remanejadas > 0,
      texto: dados.remanejadas > 0 ? `${dados.remanejadas} emenda(s) já remanejada(s). Se a planilha mudar de novo, compare e aplique só o que mudou.` : "Se a planilha mudar depois da análise de exequibilidade, importe a versão atualizada: a plataforma mostra só o que mudou, e cada ajuste vira remanejamento com ato e motivo.",
      href: `/emendas/configuracoes/importar?ano=${dados.ano}#ajustes`,
      acao: "Importar ajustes",
    },
  ];

  return (
    <Secao titulo={`Assistente do exercício ${dados.ano}`} apoio="O que falta para este ano estar pronto, na ordem em que costuma ser feito. Cada passo leva à tela onde se resolve.">
      <ol className="flex flex-col gap-2">
        {passos.map((p) => (
          <li key={p.n} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {p.ok ? <CheckCircle2 className="h-5 w-5 text-green-700" /> : <CircleDashed className="h-5 w-5 text-amber-600" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-cataguases-marinho">
                {p.n}. {p.titulo} <span className="sr-only">{p.ok ? "(feito)" : "(pendente)"}</span>
              </p>
              <p className="text-xs text-slate-600">{p.texto}</p>
            </div>
            {p.href && (
              <Link href={p.href} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-cataguases-marinho hover:bg-slate-50">
                {p.acao} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </li>
        ))}
        <li className="rounded-lg border border-slate-200 px-3 py-2.5">
          <FecharAnterior dados={dados} />
        </li>
      </ol>
      <NovoExercicio anos={dados.anosExistentes} />
    </Secao>
  );
}

function FecharAnterior({ dados }: { dados: DadosAssistente }) {
  const { erro, salvando, salvar } = useSalvar();
  const [justificativa, setJustificativa] = React.useState("");
  const [aviso, setAviso] = React.useState<string | null>(null);
  const a = dados.anterior;
  if (!a)
    return (
      <p className="text-sm text-slate-600">
        <span className="font-medium text-cataguases-marinho">6. Fechar o exercício anterior:</span> não há exercício anterior a {dados.ano}.
      </p>
    );
  const pendente = a.semSituacao > 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-cataguases-marinho">
        {a.situacao === "encerrado" ? <Lock className="h-4 w-4 text-slate-500" aria-hidden /> : <LockOpen className="h-4 w-4 text-amber-600" aria-hidden />}
        6. Fechar o exercício {a.ano}
        <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-medium", a.situacao === "encerrado" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-900")}>{a.situacao === "encerrado" ? "encerrado" : "aberto"}</span>
      </p>
      <p className="text-xs text-slate-600">
        {a.semSituacao > 0 ? `${a.semSituacao} emenda(s) de ${a.ano} ainda sem situação de encerramento. ` : `Todas as emendas de ${a.ano} têm situação definida. `}
        {a.restosAPagar > 0 ? `${a.restosAPagar} em restos a pagar continuam recebendo pagamentos no ano seguinte.` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/emendas/panorama?ano=${a.ano}&c=sem_situacao`} className="text-xs font-medium text-[#5B3FA8] underline-offset-2 hover:underline">
          Ver as emendas de {a.ano} sem situação
        </Link>
      </div>
      {a.situacao === "aberto" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {pendente && (
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
              Justificativa para fechar mesmo assim
              <input className={CAMPO} value={justificativa} maxLength={2000} onChange={(e) => setJustificativa(e.target.value)} placeholder="mínimo de 10 caracteres" />
            </label>
          )}
          <button
            type="button"
            className={BOTAO}
            disabled={salvando || (pendente && justificativa.trim().length < 10)}
            onClick={() => {
              if (window.confirm(`Fechar o exercício ${a.ano}? Restos a pagar continuam podendo receber pagamentos.`)) void salvar(async () => {
                const r = await fecharExercicio({ ano: a.ano, justificativa });
                if (r.sucesso) setAviso(r.aviso ?? null);
                return r;
              });
            }}
          >
            {salvando ? "Fechando…" : `Fechar ${a.ano}`}
          </button>
        </div>
      ) : (
        <button type="button" className={cn(BOTAO, "w-fit bg-slate-700 hover:bg-slate-800")} disabled={salvando} onClick={() => void salvar(() => reabrirExercicio(a.ano))}>
          Reabrir {a.ano}
        </button>
      )}
      {aviso && <p className="text-xs text-green-800" role="status">{aviso}</p>}
      <Erro texto={erro} />
    </div>
  );
}

function NovoExercicio({ anos }: { anos: number[] }) {
  const maior = anos.length ? Math.max(...anos) : new Date().getFullYear() - 1;
  const [ano, setAno] = React.useState(String(maior + 1));
  const [copiar, setCopiar] = React.useState(anos.length ? String(maior) : "");
  const [aviso, setAviso] = React.useState<string | null>(null);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-cataguases-marinho">
        <Rocket className="h-4 w-4 text-[#5B3FA8]" aria-hidden /> Abrir um novo exercício
      </p>
      <p className="text-xs text-slate-600">Copia do ano escolhido a cota por vereador, o mínimo da Saúde, a RCL e os dados do Município. LOA, lei e prazo de exequibilidade são de cada ano e ficam em branco.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Ano
          <input className={cn(CAMPO, "w-24")} inputMode="numeric" value={ano} onChange={(e) => setAno(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          Copiar de
          <select className={cn(CAMPO, "w-auto")} value={copiar} onChange={(e) => setCopiar(e.target.value)}>
            <option value="">Não copiar</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BOTAO}
          disabled={salvando || !/^\d{4}$/.test(ano)}
          onClick={() =>
            void salvar(async () => {
              const r = await abrirExercicio({ ano: Number(ano), copiarDe: copiar ? Number(copiar) : null });
              if (r.sucesso) setAviso(r.aviso ?? null);
              return r;
            })
          }
        >
          {salvando ? "Abrindo…" : "Abrir exercício"}
        </button>
      </div>
      {aviso && <p className="text-xs text-green-800" role="status">{aviso}</p>}
      <Erro texto={erro} />
    </div>
  );
}
