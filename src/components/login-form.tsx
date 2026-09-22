"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { entrar, type EstadoLogin } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/ui/campo-senha";

const ESTILO_CAMPO =
  "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cataguases-dourado focus:ring-1 focus:ring-cataguases-dourado";

const ESTADO_INICIAL: EstadoLogin = {};

export function FormularioLogin() {
  const searchParams = useSearchParams();
  const proximo = searchParams.get("proximo") ?? "";
  const [estado, formAction, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form action={formAction} className="w-full space-y-4">
      <input type="hidden" name="proximo" value={proximo} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-200">
          E-mail institucional
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nome@cataguases.mg.gov.br"
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="senha" className="text-sm font-medium text-slate-200">
            Senha
          </label>
          <Link
            href="/recuperar-senha"
            className="text-xs text-slate-400 transition-colors hover:text-cataguases-dourado"
          >
            Esqueci minha senha
          </Link>
        </div>
        <CampoSenha
          id="senha"
          name="senha"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={ESTILO_CAMPO}
        />
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-md border border-semaforo-vermelho/40 bg-semaforo-vermelho/10 px-3 py-2 text-sm text-red-100"
        >
          {estado.erro}
        </p>
      )}

      <Button
        type="submit"
        disabled={pendente}
        size="lg"
        className="w-full bg-cataguases-dourado text-cataguases-marinho hover:bg-cataguases-dourado/90"
      >
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
