import Link from "next/link";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { NavModulo } from "@/components/modulo/nav-modulo";
import { estiloModulo } from "@/components/modulo/tema";
import { MODULOS } from "@/lib/modulos-info";
import { obterContextoFrotas, listarManutencoes } from "@/lib/frotas/dados";
import { COR_MODULO } from "@/lib/frotas/regras";

export const dynamic = "force-dynamic";

export const metadata = { title: "Frotas · Central Cataguases" };

/**
 * Módulo Frotas — roda DENTRO do Hub (mesma sessão, mesmo deploy), como o
 * Emendas. O gate aqui só decide se a pessoa entra no módulo; o que ela
 * vê/edita lá dentro é decidido pela RLS do schema `frotas`.
 */
export default async function LayoutFrotas({ children }: { children: React.ReactNode }) {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao === "sem_login") redirect("/login?proximo=%2Ffrotas");
  if (ctx.situacao === "inativo") redirect("/login?motivo=desativado");
  if (ctx.situacao === "sem_acesso") redirect("/solicitar-acesso?modulo=frotas");

  const modulo = { nome: "Frotas", cor: COR_MODULO, app: "frotas" as const };

  if (ctx.situacao === "sem_perfil") {
    return (
      <div className="min-h-dvh bg-slate-50" style={estiloModulo(MODULOS.frotas)}>
        <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
        <main id="conteudo" className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-cataguases-marinho">Seu acesso ainda não foi configurado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O módulo Frotas está liberado para você na Central, mas falta definir o seu perfil. Peça ao administrador para concluir em
            Configurações → Usuários e acessos.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-cataguases-azul hover:underline">
            Voltar para a Central
          </Link>
        </main>
      </div>
    );
  }

  const orcamentos = await listarManutencoes()
    .then((l) => l.filter((m) => m.status_analise === "a_analisar").length)
    .catch(() => 0);
  const itens = [
    { href: "/frotas", rotulo: "Painel", exato: true },
    { href: "/frotas/combustivel", rotulo: "Combustível" },
    { href: "/frotas/manutencao", rotulo: "Manutenção", selo: orcamentos },
    { href: "/frotas/veiculos", rotulo: "Veículos" },
    { href: "/frotas/analise", rotulo: "Análise da frota" },
    ...(ctx.gestor ? [{ href: "/frotas/configuracoes", rotulo: "Configurações" }] : []),
  ];

  return (
    <div className="min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.frotas)}>
      <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
      <NavModulo itens={itens} rotuloAria="Seções do módulo Frotas" tour="nav-frotas" />
      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
