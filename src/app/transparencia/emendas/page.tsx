import { Suspense } from "react";

import { PortalEmendas } from "@/components/transparencia/portal-emendas";
import { obterContextoEmendas } from "@/lib/emendas/dados";
import { anosDoPortal, metaDoPortal, nomesDasEtapas, pacoteDoPortal } from "@/lib/emendas/portal";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Emendas impositivas · Portal da Transparência · Prefeitura de Cataguases",
  description: "Acompanhe, sem senha, as emendas impositivas dos vereadores de Cataguases: valor, beneficiário, execução, empenhos e pagamentos, atualizados automaticamente.",
  openGraph: {
    title: "Emendas impositivas · Prefeitura de Cataguases",
    description: "Cada real indicado pelos vereadores, do orçamento ao pagamento.",
    type: "website",
  },
};

/**
 * Portal público (sem login). Só mostra exercícios publicados por um gestor em /emendas/portal.
 * `?previa=1` com sessão do módulo Emendas mostra também o que ainda não foi publicado.
 */
export default async function PaginaPortal({ searchParams }: { searchParams: Promise<{ ano?: string; previa?: string }> }) {
  const { ano: anoParam, previa: previaParam } = await searchParams;
  const previa = previaParam === "1" && (await obterContextoEmendas()).situacao === "ok";
  const anos = await anosDoPortal({ incluirNaoPublicados: previa });
  const ano = anos.includes(Number(anoParam)) ? Number(anoParam) : anos[0];
  if (!ano) return <EmPreparacao />;
  const [pacote, etapas, meta] = await Promise.all([pacoteDoPortal(ano), nomesDasEtapas(), metaDoPortal(ano)]);
  return (
    <Suspense>
      <PortalEmendas
        linhas={pacote.linhas}
        versao={pacote.versao}
        geradoEm={pacote.geradoEm}
        etapas={etapas}
        ano={ano}
        anos={anos}
        previa={previa}
        meta={{
          cota: meta?.cota ?? 0,
          saudeMinPct: meta?.saudeMinPct ?? 50,
          leiLoa: meta?.leiLoa ?? null,
          dataLoa: meta?.dataLoa ?? null,
          municipio: meta?.municipio ?? null,
          unidadeParlamentar: meta?.unidadeParlamentar ?? null,
          publicadoEm: meta?.publicadoEm ?? null,
        }}
      />
    </Suspense>
  );
}

function EmPreparacao() {
  return (
    <div className="portal-raiz flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-acento-texto)]">Prefeitura de Cataguases · Transparência</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--p-tinta)]">Emendas impositivas</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--p-tinta-2)]">
          As informações do exercício estão sendo conferidas pela gestão e serão publicadas em breve nesta página.
        </p>
      </div>
    </div>
  );
}
