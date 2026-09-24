import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { FormularioMudarSenha } from "@/components/conta/formulario-mudar-senha";

export const dynamic = "force-dynamic";

export default async function PaginaMinhaConta() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-dvh bg-slate-50">
      <CabecalhoHub usuario={usuario} />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <CabecalhoPagina titulo="Minha conta" subtitulo={`Olá, ${usuario.nome}.`} />

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Alterar senha</h2>
            <p className="text-sm text-slate-600">
              Informe a senha atual e a nova senha duas vezes. Você permanece conectado depois de
              trocar. Esqueceu a senha atual?{" "}
              <a
                href="/login"
                className="font-medium text-cataguases-azul underline underline-offset-2 hover:text-cataguases-azul/80"
              >
                Saia
              </a>{" "}
              e use &ldquo;Esqueci minha senha&rdquo; na tela de login.
            </p>
          </div>
          <FormularioMudarSenha />
        </div>
      </main>
    </div>
  );
}
