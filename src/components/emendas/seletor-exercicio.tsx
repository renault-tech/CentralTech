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

/**
 * Seletor de exercício do módulo: vale para TODAS as telas (Painel, Emendas, Pendências, Panorama, Relatórios, Portal, Configurações).
 * A escolha vai para a URL (`?ano=`) e para um cookie, então abrir outra tela mantém o ano. Exercício encerrado mostra o aviso de consulta.
 */
export function SeletorExercicio({ exercicios, atual }: { exercicios: Item[]; atual: number }) {
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

  if (exercicios.length === 0) return null;

  function trocar(novo: number) {
    gravarCookie(novo);
    const p = new URLSearchParams(params.toString());
    p.set("ano", String(novo));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
      {item?.situacao === "encerrado" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900" role="status">
          <Lock className="h-3 w-3" aria-hidden /> Exercício encerrado (restos a pagar ainda recebem pagamentos)
        </span>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
        <CalendarRange className="h-4 w-4 text-[#5B3FA8]" aria-hidden />
        Exercício
        <select
          value={ano}
          onChange={(e) => trocar(Number(e.target.value))}
          className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-medium text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB] sm:h-[34px]"
        >
          {exercicios.map((e) => (
            <option key={e.ano} value={e.ano}>
              {e.ano}
              {e.situacao === "encerrado" ? " (encerrado)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
