import Link from "next/link";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { NavModulo } from "@/components/modulo/nav-modulo";
import { estiloModulo } from "@/components/modulo/tema";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { COR_MODULO } from "@/lib/imoveis/regras";
import { MODULOS } from "@/lib/modulos-info";

export const dynamic = "force-dynamic";

export const metadata = { title: "Imóveis e Consumo · Central Cataguases" };

/**
 * Módulo Imóveis e Consumo — roda DENTRO do Hub (mesma sessão, mesmo deploy), como Emendas e Frotas. O gate aqui só
 * decide se a pessoa entra no módulo; o que ela vê/edita lá dentro é decidido pela RLS do schema `imoveis`
 * (a secretaria só enxerga os imóveis da própria secretaria).
 */
export default async function LayoutImoveis({ children }: { children: React.ReactNode }) {
  const ctx = await obterContextoImoveis();
  if (ctx.situacao === "sem_login") redirect("/login?proximo=%2Fimoveis");
  if (ctx.situacao === "inativo") redirect("/login?motivo=desativado");
  if (ctx.situacao === "sem_acesso") redirect("/solicitar-acesso?modulo=imoveis");

  const modulo = { nome: "Imóveis e Consumo", cor: COR_MODULO, app: "imoveis" as const };

  if (ctx.situacao === "sem_perfil") {
    return (
      <div className="min-h-dvh bg-slate-50" style={estiloModulo(MODULOS.imoveis)}>
        <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
        <main id="conteudo" className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-cataguases-marinho">Seu acesso ainda não foi configurado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O módulo Imóveis e Consumo está liberado para você na Central, mas falta definir o seu perfil. Peça ao administrador para concluir em
            Configurações → Usuários e acessos.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-cataguases-azul hover:underline">
            Voltar para a Central
          </Link>
        </main>
      </div>
    );
  }

  const pendencias = await carregarTudo()
    .then((t) => t.pendencias.length)
    .catch(() => 0);
  const itens = [
    { href: "/imoveis", rotulo: "Painel", exato: true },
    { href: "/imoveis/imoveis", rotulo: "Imóveis" },
    { href: "/imoveis/agua", rotulo: "Água" },
    { href: "/imoveis/luz", rotulo: "Luz" },
    { href: "/imoveis/entregas", rotulo: "Entregas" },
    { href: "/imoveis/vencimentos", rotulo: "Vencimentos" },
    { href: "/imoveis/pendencias", rotulo: "Pendências", selo: pendencias },
    ...(ctx.gestor ? [{ href: "/imoveis/configuracoes", rotulo: "Configurações" }] : []),
  ];

  return (
    <div className="min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.imoveis)}>
      <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
      <NavModulo itens={itens} rotuloAria="Seções do módulo Imóveis e Consumo" tour="nav-imoveis" />
      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
