import { redirect } from "next/navigation";
import Link from "next/link";
import { Hash, Landmark, Lock, ScrollText, ShoppingBag, UserPlus, type LucideIcon } from "lucide-react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarModulosComAcesso } from "@/lib/dados/modulos";
import { contarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";
import { abrirModulo } from "@/lib/actions/sso";
import { solicitarAcessoAoModulo } from "@/lib/actions/solicitar-modulo";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { GerenciadorTours } from "@/components/ajuda/gerenciador-tours";
import { SeloModulo } from "@/components/notificacoes/sino";

export const dynamic = "force-dynamic";

const ICONES: Record<string, LucideIcon> = { compras: ShoppingBag, requerimentos: ScrollText, emendas: Landmark, numera: Hash };

/** Saudação pelo horário de Brasília (o servidor roda em UTC). */
function saudacao(): string {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const CARTAO =
  "rounded-3xl border border-[rgba(12,29,51,0.07)] bg-white/80 shadow-[0_1px_2px_rgba(12,29,51,0.05),0_10px_30px_rgba(12,29,51,0.06)] backdrop-blur";
const CARTAO_TRAVADO = "rounded-3xl border-[1.5px] border-dashed border-[rgba(12,29,51,0.20)] bg-white/40";

function IconeModulo({ chave, cor, travado }: { chave: string; cor: string; travado?: boolean }) {
  const Icone = ICONES[chave] ?? Hash;
  return (
    <span
      className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl"
      style={travado ? { backgroundColor: "rgba(12,29,51,0.10)" } : { background: `linear-gradient(145deg, color-mix(in srgb, ${cor} 78%, white), ${cor})` }}
    >
      <Icone className={travado ? "h-6 w-6 text-slate-600" : "h-6 w-6 text-white"} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

export default async function PaginaInicial({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const [usuario, { erro }] = await Promise.all([obterUsuarioAtual(), searchParams]);
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const [modulos, pendentes] = await Promise.all([
    listarModulosComAcesso(usuario),
    usuario.admin_hub ? contarSolicitacoesPendentes() : Promise.resolve(0),
  ]);
  const temAlgumAcesso = modulos.some((m) => m.temAcesso);

  return (
    <div
      className="min-h-dvh"
      style={{
        background:
          "radial-gradient(900px 520px at 12% -8%, rgba(10,95,208,0.16), transparent 60%), radial-gradient(760px 480px at 96% 4%, rgba(233,166,59,0.20), transparent 62%), #F2F4F8",
      }}
    >
      <GerenciadorTours />
      <CabecalhoHub usuario={usuario} />

      <main className="mx-auto flex max-w-[1120px] flex-col gap-7 px-4 pb-14 pt-10 sm:px-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.025em] text-cataguases-marinho sm:text-[40px]">
            {saudacao()}, {usuario.nome.split(" ")[0]}.
          </h1>
          <p className="text-[17px] leading-snug text-slate-600">Escolha um módulo para continuar. O login continua sendo o mesmo que você já usa.</p>
        </div>

        {pendentes > 0 && (
          <Link href="/configuracoes/solicitacoes" className={`${CARTAO} flex items-center gap-3.5 px-[18px] py-3.5 text-[#14213A] transition-colors hover:bg-white`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(233,166,59,0.22)]">
              <UserPlus className="h-[18px] w-[18px] text-[#8A5A00]" aria-hidden />
            </span>
            <span className="flex-1 text-[15px] font-medium">
              {pendentes} {pendentes === 1 ? "pedido de acesso aguarda" : "pedidos de acesso aguardam"} a sua decisão
            </span>
            <span className="shrink-0 text-sm font-medium text-[#0A5FD0]">Revisar</span>
          </Link>
        )}

        {!temAlgumAcesso && (
          <p className={`${CARTAO} p-6 text-sm text-slate-600`}>
            Você ainda não tem acesso liberado a nenhum módulo. Peça abaixo, ou contate o administrador da plataforma.
          </p>
        )}

        {erro === "sem_acesso" && (
          <p role="alert" className="rounded-2xl border border-semaforo-vermelho/30 bg-red-50 p-4 text-sm text-red-700">
            Este módulo não está liberado para a sua conta. Peça acesso abaixo.
          </p>
        )}

        {/* Todos os módulos aparecem, sempre (transparência: a pessoa precisa
            saber que o módulo existe para poder pedir acesso). Os sem acesso
            nunca levam ao login do app, só ao pedido de acesso. Os liberados
            não são link comum: `abrirModulo` gera um magic link de uso único
            na hora (ver `src/lib/actions/sso.ts`). */}
        <div className="grid auto-rows-fr gap-[18px] sm:grid-cols-2 lg:grid-cols-3" data-tour="cards-modulos">
          {modulos.map((m) =>
            m.temAcesso ? (
              <form key={m.chave} action={abrirModulo.bind(null, m.chave)} className="h-full">
                <button
                  type="submit"
                  className={`${CARTAO} group relative flex h-full w-full flex-col gap-3.5 p-[22px] text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_2px_4px_rgba(12,29,51,0.06),0_16px_36px_rgba(12,29,51,0.10)]`}
                >
                  <SeloModulo usuarioId={usuario.id} app={m.chave} />
                  <IconeModulo chave={m.chave} cor={m.cor} />
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-[-0.015em] text-cataguases-marinho">{m.nome}</h2>
                    <p className="text-sm leading-snug text-slate-600">{m.descricao}</p>
                  </div>
                  <span className="mt-auto pt-0.5 text-sm font-semibold" style={{ color: m.corTexto }}>
                    Abrir →
                  </span>
                </button>
              </form>
            ) : m.pedidoPendente ? (
              <div key={m.chave} className={`${CARTAO_TRAVADO} flex h-full flex-col gap-3.5 p-[22px]`}>
                <div className="flex items-start justify-between">
                  <IconeModulo chave={m.chave} cor={m.cor} travado />
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[rgba(12,29,51,0.08)] px-2.5 text-xs font-semibold text-slate-600">
                    <Lock className="h-3 w-3" aria-hidden /> Sem acesso
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold tracking-[-0.015em] text-slate-600">{m.nome}</h2>
                  <p className="text-sm leading-snug text-slate-600">{m.descricao}</p>
                </div>
                <span className="mt-auto inline-flex items-center self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                  Solicitação enviada — aguardando aprovação
                </span>
              </div>
            ) : (
              <form key={m.chave} action={solicitarAcessoAoModulo.bind(null, m.chave)} className="h-full">
                <div className={`${CARTAO_TRAVADO} flex h-full flex-col gap-3.5 p-[22px]`}>
                  <div className="flex items-start justify-between">
                    <IconeModulo chave={m.chave} cor={m.cor} travado />
                    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[rgba(12,29,51,0.08)] px-2.5 text-xs font-semibold text-slate-600">
                      <Lock className="h-3 w-3" aria-hidden /> Sem acesso
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-[-0.015em] text-slate-600">{m.nome}</h2>
                    <p className="text-sm leading-snug text-slate-600">{m.descricao}</p>
                  </div>
                  <button
                    type="submit"
                    title={`Clique para solicitar acesso a ${m.nome}`}
                    className="mt-auto h-9 self-start rounded-full bg-[#0A5FD0] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#074a9f]"
                  >
                    Solicitar acesso
                  </button>
                </div>
              </form>
            )
          )}
        </div>
      </main>
    </div>
  );
}
