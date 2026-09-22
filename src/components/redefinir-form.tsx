"use client";

import { useActionState } from "react";

import { redefinirSenha, type EstadoNovaSenha } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/ui/campo-senha";

const ESTADO_INICIAL: EstadoNovaSenha = {};

const ESTILO_CAMPO =
  "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cataguases-dourado focus:ring-1 focus:ring-cataguases-dourado";

export function FormularioRedefinir() {
  const [estado, formAction, pendente] = useActionState(redefinirSenha, ESTADO_INICIAL);

  return (
    <form action={formAction} className="w-full space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="senha" className="text-sm font-medium text-slate-200">
          Nova senha
        </label>
        <CampoSenha
          id="senha"
          name="senha"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="pelo menos 8 caracteres"
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmar" className="text-sm font-medium text-slate-200">
          Confirmar nova senha
        </label>
        <CampoSenha
          id="confirmar"
          name="confirmar"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="repita a senha"
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
        {pendente ? "Salvando…" : "Redefinir senha"}
      </Button>
    </form>
  );
}
