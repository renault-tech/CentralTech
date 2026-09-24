"use client";

import { useActionState, useEffect, useRef } from "react";

import { mudarSenhaLogado } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { CampoSenha } from "@/components/ui/campo-senha";

const ESTILO_CAMPO =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-cataguases-azul focus:ring-1 focus:ring-cataguases-azul";

export function FormularioMudarSenha() {
  const [estado, formAction, pendente] = useActionState(mudarSenhaLogado, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.sucesso) {
      formRef.current?.reset();
    }
  }, [estado.sucesso]);

  return (
    <form ref={formRef} action={formAction} className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="senhaAtual" className="text-sm font-medium text-slate-700">
          Senha atual
        </label>
        <CampoSenha
          id="senhaAtual"
          name="senhaAtual"
          autoComplete="current-password"
          required
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="senhaNova" className="text-sm font-medium text-slate-700">
          Nova senha
        </label>
        <CampoSenha
          id="senhaNova"
          name="senhaNova"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="pelo menos 8 caracteres"
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmar" className="text-sm font-medium text-slate-700">
          Confirmar nova senha
        </label>
        <CampoSenha
          id="confirmar"
          name="confirmar"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="repita a nova senha"
          className={ESTILO_CAMPO}
        />
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.erro}
        </p>
      )}

      {estado.sucesso && (
        <p
          role="status"
          className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          Senha alterada com sucesso. Você continua conectado.
        </p>
      )}

      <Button type="submit" disabled={pendente} className="w-full sm:w-auto">
        {pendente ? "Alterando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
