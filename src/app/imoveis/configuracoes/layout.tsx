import { redirect } from "next/navigation";

import { AbasNavegacao } from "@/components/layout/abas-navegacao";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterContextoImoveis } from "@/lib/imoveis/dados";

export const dynamic = "force-dynamic";

/** Configurações do módulo: mesmo desenho das outras áreas (cabeçalho, faixa de abas e índice de cards). Só o Setor de Imóveis. */
export default async function LayoutConfiguracoesImoveis({ children }: { children: React.ReactNode }) {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/imoveis");
  const abas = [
    { href: "/imoveis/configuracoes/limites", rotulo: "Limites dos alertas" },
    { href: "/imoveis/configuracoes/secretarias", rotulo: "Secretarias" },
    { href: "/imoveis/configuracoes/imobiliarias", rotulo: "Imobiliárias" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina titulo="Configurações de Imóveis e Consumo" subtitulo="Limites dos alertas, secretarias e imobiliárias." />
      <AbasNavegacao label="Configurações de Imóveis e Consumo" abas={abas} />
      <div>{children}</div>
    </div>
  );
}
