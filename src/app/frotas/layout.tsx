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
import { MODULOS } from "@/lib/modulos-info";
import { obterContextoFrotas, listarManutencoes } from "@/lib/frotas/dados";
import { ProvedorColunasExportacao } from "@/components/frotas/colunas-exportacao";
import { lerColunasOcultasDoUsuario } from "@/lib/frotas/preferencias";
import { COR_MODULO } from "@/lib/frotas/regras";

export const dynamic = "force-dynamic";

const ICONE_FROTAS: Record<string, NomeIcone> = {
  "/frotas": "painel",
  "/frotas/combustivel": "combustivel",
  "/frotas/manutencao": "manutencao",
  "/frotas/veiculos": "veiculos",
  "/frotas/custos": "custos",
  "/frotas/analise": "analise",
  "/frotas/configuracoes": "configuracoes",
};
const GRUPOS_FROTAS: { titulo: string; hrefs: string[] }[] = [
  { titulo: "Acompanhamento", hrefs: ["/frotas", "/frotas/combustivel", "/frotas/manutencao"] },
  { titulo: "Frota", hrefs: ["/frotas/veiculos", "/frotas/custos", "/frotas/analise"] },
  { titulo: "Cadastros", hrefs: ["/frotas/configuracoes"] },
];
function gruposFrotas(itens: { href: string; rotulo: string; exato?: boolean; selo?: number }[]): GrupoLateral[] {
  return GRUPOS_FROTAS.map((g) => ({
    titulo: g.titulo,
    itens: g.hrefs
      .map((h) => itens.find((i) => i.href === h))
      .filter((i): i is NonNullable<typeof i> => !!i)
      .map((i) => ({ ...i, icone: ICONE_FROTAS[i.href] })),
  }));
}

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

  const [orcamentos, colunasOcultas] = await Promise.all([
    listarManutencoes()
      .then((l) => l.filter((m) => m.status_analise === "a_analisar").length)
      .catch(() => 0),
    lerColunasOcultasDoUsuario(),
  ]);
  const itens = [
    { href: "/frotas", rotulo: "Painel", exato: true },
    { href: "/frotas/combustivel", rotulo: "Combustível" },
    { href: "/frotas/manutencao", rotulo: "Manutenção", selo: orcamentos },
    { href: "/frotas/veiculos", rotulo: "Veículos" },
    { href: "/frotas/custos", rotulo: "Manutenção × FIPE" },
    { href: "/frotas/analise", rotulo: "Análise da frota" },
    ...(ctx.gestor ? [{ href: "/frotas/configuracoes", rotulo: "Configurações" }] : []),
  ];

  const barraRecolhida = (await cookies()).get(COOKIES_BARRA.frotas)?.value === "1";
  return (
    <div className="emd min-h-dvh bg-slate-50 print:bg-white" style={estiloModulo(MODULOS.frotas)}>
      <CabecalhoHub usuario={ctx.usuario} modulo={modulo} />
      {/* Telas estreitas: a faixa de abas de sempre. Telas largas: barra lateral (mesmos itens, agrupados). */}
      <div className="lg:hidden">
        <NavModulo itens={itens} rotuloAria="Seções do módulo Frotas" largura={LARGURA_MODULO} />
      </div>
      <div className="mx-auto flex max-w-[110rem] gap-4 px-3 py-4 sm:px-5 sm:py-5 print:block print:max-w-none print:p-0">
        <BarraLateral modulo="frotas" grupos={gruposFrotas(itens)} rotuloAria="Seções do módulo Frotas" tour="nav-frotas" recolhidaInicial={barraRecolhida} />
        <main id="conteudo" className="min-w-0 flex-1 print:max-w-none print:p-0">
          <AjusteDeRolagem />
          <AvisoConexao />
          <ProvedorColunasExportacao iniciais={colunasOcultas}>{children}</ProvedorColunasExportacao>
        </main>
      </div>
    </div>
  );
}
