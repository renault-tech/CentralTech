import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarMeusModulos } from "@/lib/dados/modulos";
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

  const modulos = await listarMeusModulos(usuario);

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

        {modulos.length === 0 ? (
          <p className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Você ainda não tem acesso liberado a nenhum módulo. Contate o administrador da
            plataforma.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2" data-tour="cards-modulos">
            {modulos.map((m) => (
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
