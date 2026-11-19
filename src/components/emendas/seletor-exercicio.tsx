"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Lock } from "lucide-react";

import { COOKIE_EXERCICIO } from "@/lib/emendas/exercicio-cookie";

type Item = { ano: number; situacao: "aberto" | "encerrado" };

function gravarCookie(ano: number) {
  try {
    document.cookie = `${COOKIE_EXERCICIO}=${ano}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    /* sem cookie: a escolha vale só pela URL */
  }
}

/** Ano em vigor na tela (URL, senão o exercício aberto) e a troca dele; a escolha vai para a URL e para um cookie. */
function useExercicio(exercicios: Item[], atual: number) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const doUrl = Number(params.get("ano"));
  const ano = exercicios.some((e) => e.ano === doUrl) ? doUrl : atual;
  const item = exercicios.find((e) => e.ano === ano);

  // Quando outra parte da tela troca o ano na URL (ex.: o seletor do Painel), o cookie acompanha.
  React.useEffect(() => {
    if (exercicios.some((e) => e.ano === doUrl)) gravarCookie(doUrl);
  }, [doUrl, exercicios]);

  function trocar(novo: number) {
    gravarCookie(novo);
    const p = new URLSearchParams(params.toString());
    p.set("ano", String(novo));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }
  return { ano, item, trocar };
}

/**
 * Seletor de exercício do módulo, no cabeçalho escuro, ao lado do nome do módulo (antes ocupava uma linha inteira
 * só para ele). Vale para TODAS as telas (Painel, Emendas, Pendências, Panorama, Relatórios, Portal, Configurações).
 */
export function SeletorExercicio({ exercicios, atual }: { exercicios: Item[]; atual: number }) {
  const { ano, item, trocar } = useExercicio(exercicios, atual);
  if (exercicios.length === 0) return null;

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-slate-200 print:hidden">
      <CalendarRange className="h-4 w-4 flex-none" aria-hidden />
      <span className="hidden sm:inline">Exercício</span>
      <select
        aria-label="Exercício"
        value={ano}
        onChange={(e) => trocar(Number(e.target.value))}
        title={item?.situacao === "encerrado" ? "Exercício encerrado: só consulta e restos a pagar" : undefined}
        className="h-11 cursor-pointer rounded-lg border border-white/25 bg-white/10 px-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-white/15 focus-visible:border-[#E9A63B] sm:h-10 [&>option]:text-slate-900"
      >
        {exercicios.map((e) => (
          <option key={e.ano} value={e.ano}>
            {e.ano}
            {e.situacao === "encerrado" ? " (encerrado)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Aviso (só quando o exercício está encerrado): consulta e restos a pagar. Fica na página, não no cabeçalho. */
export function AvisoExercicioEncerrado({ exercicios, atual }: { exercicios: Item[]; atual: number }) {
  const { item } = useExercicio(exercicios, atual);
  if (item?.situacao !== "encerrado") return null;
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 print:hidden" role="status">
      <Lock className="h-4 w-4 flex-none" aria-hidden />
      Exercício encerrado: os restos a pagar ainda recebem pagamentos.
    </p>
  );
}
