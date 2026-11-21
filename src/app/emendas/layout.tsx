import * as React from "react";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import Link from "next/link";

import { NavModulo } from "@/components/modulo/nav-modulo";
import { BarraLateral } from "@/components/emendas/barra-lateral";
import { AlternadorDesign, ProvedorDesign } from "@/components/emendas/design-emendas";
import { podeAlternarDesign, usarNovoDesign } from "@/lib/emendas/design";
import { estiloModulo, LARGURA_MODULO, MARGENS_MODULO } from "@/components/modulo/tema";
import { MODULOS } from "@/lib/modulos-info";
import { ProvedorCatalogo } from "@/components/emendas/catalogo-etapas";
import { medir } from "@/lib/emendas/tempo";
import { AvisoExercicioEncerrado, SeletorExercicio } from "@/components/emendas/seletor-exercicio";
import { contarPropostasPendentes, obterCatalogoEtapas, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { COR_MODULO, ehGestor } from "@/lib/emendas/regras";
import { anosDoPortal, metaDoPortal, pacoteDoPortal } from "@/lib/emendas/portal";
import { contarPorGravidade, verificarPortal } from "@/lib/emendas/portal-verificacao";

export const dynamic = "force-dynamic";


export const metadata = { title: "Emendas Impositivas · Central Cataguases" };

/**
 * Módulo Emendas Impositivas — o primeiro que roda DENTRO do Hub (mesma
 * sessão, mesmo deploy). O gate aqui só decide se a pessoa entra no
 * módulo; o que ela vê/edita lá dentro é decidido pela RLS do schema
 * `emendas` (permissão por secretaria).
 */
/** Alertas críticos do que está (ou vai) ao ar no portal público, para o selo do menu. Leituras em cache. */
async function criticosDoPortal(): Promise<number> {
  const [ano] = await anosDoPortal({ incluirNaoPublicados: true });
  if (!ano) return 0;
  const [pacote, meta] = await Promise.all([pacoteDoPortal(ano), metaDoPortal(ano)]);
  return meta ? contarPorGravidade(verificarPortal(pacote.linhas, meta)).critico : 0;
}

export default async function LayoutEmendas({ children }: { children: React.ReactNode }) {
  // O catálogo de fases não depende do contexto: as duas buscas andam juntas.
  const promessaCatalogo = medir("layout:catalogo", () => obterCatalogoEtapas());
  const ctx = await medir("layout:contexto", () => obterContextoEmendas());
  if (ctx.situacao === "sem_login") redirect("/login?proximo=%2Femendas");
  if (ctx.situacao === "inativo") redirect("/login?motivo=desativado");
  if (ctx.situacao === "sem_acesso") redirect("/solicitar-acesso?modulo=emendas");

  const modulo = { nome: "Emendas Impositivas", cor: COR_MODULO, app: "emendas" as const };

  if (ctx.situacao === "sem_perfil") {
    promessaCatalogo.catch(() => {});
    return (
      <div className="min-h-dvh bg-slate-50" style={estiloModulo(MODULOS.emendas)}>
        <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
        <main id="conteudo" className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
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
  const [catalogo, propostasPendentes, alertasPortal, { exercicio: exercicioAtual, exercicios }] = await Promise.all([
    promessaCatalogo,
    contarPropostasPendentes().catch(() => 0),
    criticosDoPortal().catch(() => 0),
    resolverExercicio(null),
  ]);
  const itens = [
    { href: "/emendas", rotulo: "Painel", exato: true },
    { href: "/emendas/lista", rotulo: "Emendas" },
    { href: "/emendas/pendencias", rotulo: "Pendências" },
    { href: "/emendas/conformidade", rotulo: "Conformidade" },
    { href: "/emendas/panorama", rotulo: "Panorama" },
    { href: "/emendas/aprovacoes", rotulo: gestor ? "Aprovações" : "Minhas propostas", selo: propostasPendentes },
    { href: "/emendas/relatorios", rotulo: "Relatórios" },
    { href: "/emendas/vereadores", rotulo: "Vereadores" },
    { href: "/emendas/secretarias", rotulo: "Secretarias" },
    ...(gestor ? [{ href: "/emendas/configuracoes", rotulo: "Configurações" }] : []),
    { href: "/emendas/portal", rotulo: "Portal público", selo: alertasPortal },
  ];

  const [novo, podeAlternar] = await Promise.all([usarNovoDesign(), podeAlternarDesign()]);
  const cabecalho = (
    <CabecalhoHub
      usuario={ctx.usuario}
      modulo={modulo}
      contexto={
        exercicioAtual && (
          <React.Suspense fallback={null}>
            <SeletorExercicio exercicios={exercicios.map((e) => ({ ano: e.ano, situacao: e.situacao }))} atual={exercicioAtual.ano} />
          </React.Suspense>
        )
      }
    />
  );
  const aviso = exercicioAtual && (
    <React.Suspense fallback={null}>
      <AvisoExercicioEncerrado exercicios={exercicios.map((e) => ({ ano: e.ano, situacao: e.situacao }))} atual={exercicioAtual.ano} />
    </React.Suspense>
  );

  // PROVISÓRIO: visual original (como era) × novo, alternável só pelo administrador (ver lib/emendas/design.ts).
  if (!novo) {
    return (
      <div className="min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.emendas)}>
        {cabecalho}
        <NavModulo itens={itens} rotuloAria="Seções do módulo Emendas" tour="nav-emendas" largura={LARGURA_MODULO} />
        <main id="conteudo" className={`mx-auto ${LARGURA_MODULO} ${MARGENS_MODULO} print:max-w-none print:p-0`}>
          {aviso}
          <ProvedorDesign novo={false}>
            <ProvedorCatalogo catalogo={catalogo}>{children}</ProvedorCatalogo>
          </ProvedorDesign>
        </main>
        {podeAlternar && <AlternadorDesign novo={false} />}
      </div>
    );
  }

  return (
    <div className="emd min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.emendas)}>
      {cabecalho}
      {/* Telas estreitas: a faixa de abas de sempre. Telas largas: barra lateral (mesmos itens, agrupados). */}
      <div className="lg:hidden">
        <NavModulo itens={itens} rotuloAria="Seções do módulo Emendas" largura={LARGURA_MODULO} />
      </div>
      <div className={`mx-auto flex ${LARGURA_MODULO} gap-6 px-4 py-5 sm:px-6 sm:py-6 print:block print:max-w-none print:p-0`}>
        <BarraLateral
          itens={itens.map((i) => ({ ...i, selos: i.href === "/emendas/portal" ? ("alerta" as const) : undefined }))}
          rotuloAria="Seções do módulo Emendas"
          tour="nav-emendas"
        />
        <main id="conteudo" className="min-w-0 flex-1 print:max-w-none print:p-0">
          {aviso}
          <ProvedorDesign novo>
            <ProvedorCatalogo catalogo={catalogo}>{children}</ProvedorCatalogo>
          </ProvedorDesign>
        </main>
      </div>
      {podeAlternar && <AlternadorDesign novo />}
    </div>
  );
}
