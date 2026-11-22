import Link from "next/link";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { cookies } from "next/headers";

import { AjusteDeRolagem } from "@/components/modulo/ajuste-de-rolagem";
import { BarraLateral, type GrupoLateral, type NomeIcone } from "@/components/modulo/barra-lateral";
import { AvisoConexao } from "@/components/modulo/estados-tela";
import { NavModulo } from "@/components/modulo/nav-modulo";
import { estiloModulo, LARGURA_MODULO } from "@/components/modulo/tema";
import { COOKIES_BARRA } from "@/lib/modulo/barra-cookie";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { COR_MODULO } from "@/lib/imoveis/regras";
import { MODULOS } from "@/lib/modulos-info";

export const dynamic = "force-dynamic";

const ICONE_IMOVEIS: Record<string, NomeIcone> = {
  "/imoveis": "painel",
  "/imoveis/imoveis": "imoveis",
  "/imoveis/agua": "agua",
  "/imoveis/luz": "luz",
  "/imoveis/entregas": "entregas",
  "/imoveis/vencimentos": "vencimentos",
  "/imoveis/pendencias": "pendencias",
  "/imoveis/configuracoes": "configuracoes",
};
const GRUPOS_IMOVEIS: { titulo: string; hrefs: string[] }[] = [
  { titulo: "Acompanhamento", hrefs: ["/imoveis", "/imoveis/pendencias", "/imoveis/vencimentos"] },
  { titulo: "Imóveis e consumo", hrefs: ["/imoveis/imoveis", "/imoveis/agua", "/imoveis/luz", "/imoveis/entregas"] },
  { titulo: "Cadastros", hrefs: ["/imoveis/configuracoes"] },
];
function gruposImoveis(itens: { href: string; rotulo: string; exato?: boolean; selo?: number }[]): GrupoLateral[] {
  return GRUPOS_IMOVEIS.map((g) => ({
    titulo: g.titulo,
    itens: g.hrefs
      .map((h) => itens.find((i) => i.href === h))
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({ ...i, icone: ICONE_IMOVEIS[i.href], selos: i.href === "/imoveis/pendencias" ? ("alerta" as const) : undefined })),
  }));
}

export const metadata = { title: "Imóveis e Consumo · Central Cataguases" };

/**
 * Módulo Imóveis e Consumo — roda DENTRO do Hub (mesma sessão, mesmo deploy), como Emendas e Frotas. O gate aqui só
 * decide se a pessoa entra no módulo; o que ela vê/edita lá dentro é decidido pela RLS do schema `imoveis`
 * (a secretaria só enxerga os imóveis da própria secretaria).
 */
export default async function LayoutImoveis({ children }: { children: React.ReactNode }) {
  // O selo de pendências do menu sai junto com o contexto (as leituras são as mesmas das telas, em cache curto): sem esperar uma etapa atrás da outra.
  const pendenciasPronto = carregarTudo()
    .then((t) => t.pendencias.length)
    .catch(() => 0);
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

  const pendencias = await pendenciasPronto;
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

  const barraRecolhida = (await cookies()).get(COOKIES_BARRA.imoveis)?.value === "1";
  return (
    <div className="emd min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.imoveis)}>
      <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
      {/* Telas estreitas: a faixa de abas de sempre. Telas largas: barra lateral (mesmos itens, agrupados). */}
      <div className="lg:hidden">
        <NavModulo itens={itens} rotuloAria="Seções do módulo Imóveis e Consumo" largura={LARGURA_MODULO} />
      </div>
      <div className="mx-auto flex max-w-[110rem] gap-4 px-3 py-4 sm:px-5 sm:py-5 print:block print:max-w-none print:p-0">
        <BarraLateral modulo="imoveis" grupos={gruposImoveis(itens)} rotuloAria="Seções do módulo Imóveis e Consumo" tour="nav-imoveis" recolhidaInicial={barraRecolhida} />
        <main id="conteudo" className="min-w-0 flex-1 print:max-w-none print:p-0">
          <AjusteDeRolagem />
          <AvisoConexao />
          {children}
        </main>
      </div>
    </div>
  );
}
