import { redirect } from "next/navigation";
import Link from "next/link";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarMeusModulos } from "@/lib/dados/modulos";
import { Brasao } from "@/components/brasao";
import { sair } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

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
      <header className="flex items-center justify-between border-b border-slate-200 bg-cataguases-marinho px-4 py-3 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <Brasao tamanho={32} />
          <div>
            <p className="text-sm font-semibold leading-tight">Central Cataguases</p>
            <p className="text-[11px] leading-tight text-slate-300">Prefeitura de Cataguases</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          {usuario.admin_hub && (
            <Link
              href="/configuracoes"
              className="rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              Configurações
            </Link>
          )}
          <span className="hidden text-xs text-slate-400 sm:inline">{usuario.nome}</span>
          <form action={sair}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
            >
              Sair
            </Button>
          </form>
        </nav>
      </header>

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
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {modulos.map((m) => (
              <a
                key={m.chave}
                href={m.url}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderTopColor: m.cor, borderTopWidth: 4 }}
              >
                <h2 className="text-base font-semibold text-slate-800 group-hover:text-cataguases-azul">
                  {m.nome}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">{m.descricao}</p>
                <span
                  className="mt-3 inline-block text-xs font-medium"
                  style={{ color: m.cor }}
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
