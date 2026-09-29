import { ShieldAlert } from "lucide-react";

import { listarAdocaoHub } from "@/lib/dados/login-direto";
import { MODULOS } from "@/lib/modulos-info";
import { InterruptorBloqueio } from "@/components/hub/interruptor-bloqueio";

export async function PainelLoginDireto() {
  const adocao = await listarAdocaoHub();

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-cataguases-marinho" aria-hidden />
        <h2 className="text-sm font-semibold text-cataguases-marinho">Login direto por aplicativo</h2>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        Bloquear desliga o formulário de senha do próprio app — a pessoa passa a precisar entrar por
        aqui (ou, já logada aqui, entrar automaticamente sem digitar senha de novo). Desligado por
        padrão em todos os 3; ligue só depois que o &ldquo;já acessou pelo Hub&rdquo; abaixo mostrar
        que a maioria já migrou.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {adocao.map((a) => {
          const m = MODULOS[a.modulo];
          const pct = a.ativos > 0 ? Math.round((a.jaViaHub / a.ativos) * 100) : 0;
          return (
            <div key={a.modulo} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.cor }}
                  aria-hidden
                />
                <p className="text-sm font-medium text-slate-700">{m.nomeCurto}</p>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                <b className="text-slate-700">
                  {a.jaViaHub} de {a.ativos}
                </b>{" "}
                usuários ativos já acessaram pelo Hub ({pct}%)
              </p>

              <InterruptorBloqueio modulo={a.modulo} bloqueadoInicial={a.bloqueado} />
              {a.modulo === "numera" && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Numera tem projeto Supabase próprio — este interruptor grava lá também
                  (`app_config.loginDiretoBloqueado`), separado do bookkeeping do Hub.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
