"use client";

import { useActionState } from "react";

import { solicitarAcesso, type EstadoSolicitacao } from "@/lib/actions/solicitar-acesso";
import { Button } from "@/components/ui/button";
import { MODULOS } from "@/lib/modulos-info";

const ESTILO_CAMPO =
  "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-cataguases-dourado focus:ring-1 focus:ring-cataguases-dourado";

const ESTADO_INICIAL: EstadoSolicitacao = {};

const TODOS_MODULOS = Object.values(MODULOS);

export function SolicitarAcessoForm() {
  const [estado, formAction, pendente] = useActionState(solicitarAcesso, ESTADO_INICIAL);

  if (estado.enviado) {
    return (
      <div className="w-full space-y-3 rounded-md border border-semaforo-verde/40 bg-semaforo-verde/10 px-4 py-4 text-center text-sm text-green-100">
        <p>
          Pedido enviado! O administrador vai avaliar e liberar o acesso aos módulos
          escolhidos — você será avisado por e-mail.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="nome" className="text-sm font-medium text-slate-200">
          Nome completo
        </label>
        <input id="nome" name="nome" required placeholder="Seu nome" className={ESTILO_CAMPO} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-200">
          E-mail institucional
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="nome@cataguases.mg.gov.br"
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-200">A quais sistemas você precisa de acesso?</p>
        <div className="space-y-1.5">
          {TODOS_MODULOS.map((m) => (
            <label
              key={m.chave}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200"
            >
              <input type="checkbox" name="modulos" value={m.chave} />
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: m.cor }}
                aria-hidden
              />
              {m.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="secretaria" className="text-sm font-medium text-slate-200">
          Secretaria/setor <span className="text-slate-500">(opcional)</span>
        </label>
        <input
          id="secretaria"
          name="secretaria"
          placeholder="Ex: Secretaria de Saúde"
          className={ESTILO_CAMPO}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="justificativa" className="text-sm font-medium text-slate-200">
          Mensagem <span className="text-slate-500">(opcional)</span>
        </label>
        <textarea
          id="justificativa"
          name="justificativa"
          rows={3}
          placeholder="Conte um pouco sobre para que você precisa do acesso"
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
        {pendente ? "Enviando…" : "Enviar pedido de acesso"}
      </Button>
    </form>
  );
}
