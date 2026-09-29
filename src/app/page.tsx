import { redirect } from "next/navigation";
import { Lock } from "lucide-react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarModulosComAcesso } from "@/lib/dados/modulos";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { GerenciadorTours } from "@/components/ajuda/gerenciador-tours";

export const dynamic = "force-dynamic";

export default async function PaginaInicial() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  if (!usuario.ativo) {
    redirect("/login?motivo=desativado");
  }

  const modulos = await listarModulosComAcesso(usuario);
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

        {!temAlgumAcesso && (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Você ainda não tem acesso liberado a nenhum módulo. Peça abaixo, ou contate o
            administrador da plataforma.
          </p>
        )}

        {/* Todos os módulos aparecem, sempre — não só os liberados
            (transparência: a pessoa precisa saber que "Requerimentos"
            existe para poder pedir acesso). Os sem acesso não levam a
            lugar nenhum além do pedido de acesso — nunca ao login do
            app, que só ia confirmar a senha certa e travar depois, sem
            explicar por quê (o mesmo tipo de confusão já investigado:
            "tentei por um, era por outro"). */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2" data-tour="cards-modulos">
          {modulos.map((m) =>
            m.temAcesso ? (
              <a
                key={m.chave}
                href={`${m.url}?origem=hub`}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderTopColor: m.cor, borderTopWidth: 4 }}
              >
                <h2 className="text-base font-semibold text-slate-800 group-hover:text-cataguases-azul">
                  {m.nome}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">{m.descricao}</p>
                <span
                  className="mt-3 inline-block text-xs font-medium"
                  style={{ color: m.corTexto }}
                >
                  Abrir →
                </span>
              </a>
            ) : (
              <a
                key={m.chave}
                href={`/solicitar-acesso?modulo=${m.chave}`}
                className="group rounded-xl border border-dashed border-slate-300 bg-slate-100/60 p-5 opacity-75 transition-opacity hover:opacity-100"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <h2 className="text-base font-semibold text-slate-500">{m.nome}</h2>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">{m.descricao}</p>
                <span className="mt-3 inline-block text-xs font-medium text-slate-500 group-hover:text-cataguases-azul">
                  Sem acesso — solicitar →
                </span>
              </a>
            )
          )}
        </div>
      </main>
    </div>
  );
}
