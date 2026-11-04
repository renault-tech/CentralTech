import { redirect } from "next/navigation";

import { AbasNavegacao } from "@/components/layout/abas-navegacao";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterContextoFrotas } from "@/lib/frotas/dados";

export const dynamic = "force-dynamic";

/** Configurações do módulo: mesmo desenho das outras áreas (cabeçalho, faixa de abas e índice de cards). Só o Setor de Frotas. */
export default async function LayoutConfiguracoesFrotas({ children }: { children: React.ReactNode }) {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/frotas");

  const abas = [
    { href: "/frotas/configuracoes/limites", rotulo: "Limites dos alertas" },
    { href: "/frotas/configuracoes/secretarias", rotulo: "Secretarias" },
    { href: "/frotas/configuracoes/fornecedores", rotulo: "Postos, oficinas e locadoras" },
    { href: "/frotas/configuracoes/avisos", rotulo: "Avisos e acesso" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina titulo="Configurações de Frotas" subtitulo="Limites dos alertas, secretarias, fornecedores e avisos do módulo." />
      <AbasNavegacao label="Configurações de Frotas" abas={abas} />
      <div>{children}</div>
    </div>
  );
}
