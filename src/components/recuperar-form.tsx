"use client";

import { useActionState } from "react";
import Link from "next/link";

import { solicitarRecuperacao, type EstadoRecuperacao } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const ESTADO_INICIAL: EstadoRecuperacao = {};

const ESTILO_CAMPO =
  "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cataguases-dourado focus:ring-1 focus:ring-cataguases-dourado";

export function FormularioRecuperacao() {
  const [estado, formAction, pendente] = useActionState(solicitarRecuperacao, ESTADO_INICIAL);

  if (estado.enviado) {
    return (
      <div className="w-full space-y-4 text-center">
        <p className="rounded-md border border-semaforo-verde/40 bg-semaforo-verde/10 px-3 py-3 text-sm text-green-100">
          Se este e-mail estiver cadastrado, enviamos um link para redefinir a
          senha. Verifique sua caixa de entrada (e o spam).
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-slate-400 transition-colors hover:text-cataguases-dourado"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-4">
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
        {pendente ? "Enviando…" : "Enviar link de recuperação"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm text-slate-400 transition-colors hover:text-cataguases-dourado"
      >
        Voltar para o login
      </Link>
    </form>
  );
}
