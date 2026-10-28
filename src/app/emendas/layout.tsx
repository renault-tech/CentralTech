import Link from "next/link";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { NavModulo } from "@/components/emendas/nav-modulo";
import { ProvedorCatalogo } from "@/components/emendas/catalogo-etapas";
import { contarPropostasPendentes, obterCatalogoEtapas, obterContextoEmendas } from "@/lib/emendas/dados";
import { COR_MODULO, ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export const metadata = { title: "Emendas Impositivas · Central Cataguases" };

/**
 * Módulo Emendas Impositivas — o primeiro que roda DENTRO do Hub (mesma
 * sessão, mesmo deploy). O gate aqui só decide se a pessoa entra no
 * módulo; o que ela vê/edita lá dentro é decidido pela RLS do schema
 * `emendas` (permissão por secretaria).
 */
export default async function LayoutEmendas({ children }: { children: React.ReactNode }) {
  // O catálogo de fases não depende do contexto: as duas buscas andam juntas.
  const promessaCatalogo = obterCatalogoEtapas();
  const ctx = await obterContextoEmendas();
  if (ctx.situacao === "sem_login") redirect("/login?proximo=%2Femendas");
  if (ctx.situacao === "inativo") redirect("/login?motivo=desativado");
  if (ctx.situacao === "sem_acesso") redirect("/solicitar-acesso?modulo=emendas");

  const modulo = { nome: "Emendas Impositivas", cor: COR_MODULO, app: "emendas" as const };

  if (ctx.situacao === "sem_perfil") {
    promessaCatalogo.catch(() => {});
    return (
      <div className="min-h-dvh bg-slate-50">
        <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold text-cataguases-marinho">Seu acesso ainda não foi configurado</h1>
          <p className="mt-2 text-sm text-slate-600">
            O módulo Emendas está liberado para você na Central, mas falta definir o seu perfil e as secretarias
            que você acompanha. Peça ao administrador para concluir em Configurações → Usuários e acessos.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-cataguases-azul hover:underline">
            Voltar para a Central
          </Link>
        </main>
      </div>
    );
  }

  const gestor = ehGestor(ctx.perfil);
  const [catalogo, propostasPendentes] = await Promise.all([promessaCatalogo, contarPropostasPendentes().catch(() => 0)]);
  const itens = [
    { href: "/emendas", rotulo: "Painel", exato: true },
    { href: "/emendas/lista", rotulo: "Emendas" },
    { href: "/emendas/pendencias", rotulo: "Pendências" },
    { href: "/emendas/aprovacoes", rotulo: gestor ? "Aprovações" : "Minhas propostas", selo: propostasPendentes },
    { href: "/emendas/relatorios", rotulo: "Relatórios" },
    { href: "/emendas/vereadores", rotulo: "Vereadores" },
    { href: "/emendas/secretarias", rotulo: "Secretarias" },
    ...(gestor ? [{ href: "/emendas/configuracoes", rotulo: "Configurações" }] : []),
    { href: "/transparencia/emendas", rotulo: "Portal público", externo: true },
  ];

  return (
    <div className="min-h-dvh bg-slate-50 print:bg-white">
      <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
      <NavModulo itens={itens} podeCriar={gestor} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        <ProvedorCatalogo catalogo={catalogo}>{children}</ProvedorCatalogo>
      </main>
    </div>
  );
}
