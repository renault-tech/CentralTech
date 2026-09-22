import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { NOVIDADES } from "@/lib/novidades";

export const dynamic = "force-dynamic";

function formatarData(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function PaginaNovidades() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-dvh bg-slate-50">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-cataguases-azul"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Voltar
        </Link>

        <div className="mt-3">
          <CabecalhoPagina
            titulo="Novidades"
            subtitulo="O que mudou na Central Cataguases, mais recente primeiro."
          />
        </div>

        <div className="mt-6 space-y-4">
          {NOVIDADES.map((n) => (
            <article key={n.data + n.titulo} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-cataguases-azul">
                {formatarData(n.data)}
              </p>
              <h2 className="mt-1 text-sm font-semibold text-cataguases-marinho">{n.titulo}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{n.descricao}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
