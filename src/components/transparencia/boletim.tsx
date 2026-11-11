"use client";

import * as React from "react";
import { Mail } from "lucide-react";

import { assinarBoletim } from "@/lib/emendas/actions-boletim";

/** Cadastro do boletim por e-mail: confirmação dupla, consentimento expresso, cancelamento a qualquer momento. */
export function CadastroBoletim({ vereadores, vereadorAtual }: { vereadores: string[]; vereadorAtual: string }) {
  const [email, setEmail] = React.useState("");
  const [vereador, setVereador] = React.useState(vereadorAtual);
  const [aceite, setAceite] = React.useState(false);
  const [resp, setResp] = React.useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();
  // Acompanha o filtro de vereador da página (estado derivado, sem efeito).
  const [anterior, setAnterior] = React.useState(vereadorAtual);
  if (anterior !== vereadorAtual) {
    setAnterior(vereadorAtual);
    setVereador(vereadorAtual);
  }

  return (
    <form
      data-tour="portal-boletim"
      className="portal-cartao relative overflow-hidden p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => setResp(await assinarBoletim({ email, vereador: vereador || undefined, consentimento: aceite })));
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, var(--p-acento-suave), transparent 70%)" }} />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--p-acento-suave)] text-[var(--p-acento-texto)]">
            <Mail className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="portal-titulo-secao mt-4">Receba as novidades por e-mail</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--p-tinta-2)]">
            Uma vez por dia, só quando algo muda: nova emenda, empenho, pagamento ou mudança de fase. De todas as emendas ou só das de um vereador.
          </p>
        </div>
        {resp?.ok ? (
          <p role="status" className="rounded-2xl bg-[var(--p-acento-suave)] p-5 text-[15px] font-medium text-[var(--p-tinta)]">
            {resp.mensagem}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Seu e-mail</span>
                <input type="email" required autoComplete="email" inputMode="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="portal-campo w-full" />
              </label>
              <label className="sm:w-56">
                <span className="sr-only">De qual vereador</span>
                <select value={vereador} onChange={(e) => setVereador(e.target.value)} className="portal-campo w-full">
                  <option value="">Todas as emendas</option>
                  {vereadores.map((v) => (
                    <option key={v} value={v}>
                      Só de {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2.5 text-[13px] leading-snug text-[var(--p-tinta-2)]">
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--p-acento)]" />
              <span>
                Autorizo o uso do meu e-mail somente para o envio deste boletim. Posso cancelar a qualquer momento pelo link em cada mensagem (Lei 13.709/2018 — LGPD).
              </span>
            </label>
            {resp && !resp.ok && (
              <p role="alert" className="text-[13px] font-medium text-[var(--e-impedida)]">
                {resp.mensagem}
              </p>
            )}
            <button type="submit" disabled={pendente || !aceite || !email} className="portal-botao self-start">
              {pendente ? "Enviando…" : "Quero receber"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
