import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarModulosComAcesso } from "@/lib/dados/modulos";
import { contarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";
import { abrirModulo } from "@/lib/actions/sso";
import { solicitarAcessoAoModulo } from "@/lib/actions/solicitar-modulo";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { GerenciadorTours } from "@/components/ajuda/gerenciador-tours";
import { SeloModulo } from "@/components/notificacoes/sino";

export const dynamic = "force-dynamic";

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
    <div className="min-h-dvh bg-slate-50">
      <GerenciadorTours />
      <CabecalhoHub usuario={usuario} />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <CabecalhoPagina
          titulo={`Bem-vindo(a), ${usuario.nome.split(" ")[0]}`}
          subtitulo="Escolha o sistema que deseja acessar. O login de cada um continua sendo o mesmo que você já usa."
          tamanho="grande"
        />

        {pendentes > 0 && (
          <Link
            href="/configuracoes/solicitacoes"
            className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-cataguases-vermelho/30 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors hover:bg-red-100"
          >
            <span>
              <b>
                {pendentes} {pendentes === 1 ? "pedido de acesso aguarda" : "pedidos de acesso aguardam"}
              </b>{" "}
              a sua decisão.
            </span>
            <span className="shrink-0 font-medium">Ver pedidos →</span>
          </Link>
        )}

        {!temAlgumAcesso && (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Você ainda não tem acesso liberado a nenhum módulo. Peça abaixo, ou contate o
            administrador da plataforma.
          </p>
        )}

        {erro === "sem_acesso" && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-semaforo-vermelho/30 bg-red-50 p-4 text-sm text-red-700"
          >
            Este módulo não está liberado para a sua conta. Peça acesso abaixo.
          </p>
        )}

        {/* Todos os módulos aparecem, sempre — não só os liberados
            (transparência: a pessoa precisa saber que "Requerimentos"
            existe para poder pedir acesso). Os sem acesso não levam a
            lugar nenhum além do pedido de acesso — nunca ao login do
            app, que só ia confirmar a senha certa e travar depois, sem
            explicar por quê (o mesmo tipo de confusão já investigado:
            "tentei por um, era por outro"). Os liberados não são mais um
            link comum: `abrirModulo` gera um magic link de uso único na
            hora e manda o navegador já autenticado — sem pedir senha de
            novo (ver comentário em `src/lib/actions/sso.ts`). */}
        <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2" data-tour="cards-modulos">
          {modulos.map((m) =>
            m.temAcesso ? (
              <form key={m.chave} action={abrirModulo.bind(null, m.chave)} className="h-full">
                <button
                  type="submit"
                  className="group relative flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderTopColor: m.cor, borderTopWidth: 4 }}
                >
                  <SeloModulo usuarioId={usuario.id} app={m.chave} />
                  <h2 className="pr-10 text-base font-semibold text-slate-800 group-hover:text-cataguases-azul">
                    {m.nome}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">{m.descricao}</p>
                  <span
                    className="mt-auto inline-block pt-3 text-xs font-medium"
                    style={{ color: m.corTexto }}
                  >
                    Abrir →
                  </span>
                </button>
              </form>
            ) : m.pedidoPendente ? (
              <div
                key={m.chave}
                className="flex h-full flex-col rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-5 opacity-80"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <h2 className="text-base font-semibold text-slate-500">{m.nome}</h2>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">{m.descricao}</p>
                <span className="mt-auto inline-flex items-center gap-1 self-start rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Solicitação enviada — aguardando aprovação
                </span>
              </div>
            ) : (
              <form key={m.chave} action={solicitarAcessoAoModulo.bind(null, m.chave)} className="h-full">
                <button
                  type="submit"
                  className="group flex h-full w-full flex-col rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-5 text-left opacity-75 transition-opacity hover:opacity-100"
                  title={`Clique para solicitar acesso a ${m.nome}`}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <h2 className="text-base font-semibold text-slate-500">{m.nome}</h2>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-400">{m.descricao}</p>
                  <span className="mt-auto inline-block self-start rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 transition-colors group-hover:border-cataguases-azul group-hover:text-cataguases-azul">
                    Solicitar acesso
                  </span>
                </button>
              </form>
            )
          )}
        </div>
      </main>
    </div>
  );
}
