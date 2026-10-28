import { redirect } from "next/navigation";

import { AbasNavegacao } from "@/components/layout/abas-navegacao";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

/** Configurações do módulo: só o administrador do Hub e o gestor (todo
 * acesso e toda regra passam por eles). */
export default async function LayoutConfiguracoesEmendas({ children }: { children: React.ReactNode }) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") redirect("/emendas");
  if (!ehGestor(ctx.perfil)) redirect("/emendas");

  const abas = [
    { href: "/emendas/configuracoes/exercicio", rotulo: "Exercício" },
    { href: "/emendas/configuracoes/exequibilidade", rotulo: "Exequibilidade" },
    { href: "/emendas/configuracoes/fases", rotulo: "Fases do fluxo" },
    { href: "/emendas/configuracoes/catalogo", rotulo: "Fases e documentos por tipo" },
    { href: "/emendas/configuracoes/vereadores", rotulo: "Vereadores" },
    { href: "/emendas/configuracoes/secretarias", rotulo: "Secretarias e unidades" },
    { href: "/emendas/configuracoes/beneficiarios", rotulo: "Beneficiários" },
    { href: "/emendas/configuracoes/usuarios", rotulo: "Usuários e permissões" },
    { href: "/emendas/configuracoes/importar", rotulo: "Importar planilha" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina titulo="Configurações de Emendas" subtitulo="Exercícios, cadastros, permissões por secretaria e importação de planilhas." />
      <AbasNavegacao label="Configurações de Emendas" abas={abas} />
      <div>{children}</div>
    </div>
  );
}
