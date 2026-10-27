import { PortalEmendas } from "@/components/transparencia/portal-emendas";
import { anosDoPortal, dadosDoPortal, nomesDasEtapas } from "@/lib/emendas/portal";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Emendas impositivas · Transparência · Prefeitura de Cataguases",
  description: "Acompanhe as emendas impositivas dos vereadores: valor, beneficiário, execução e pagamento.",
};

export default async function PaginaPortal({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano: anoParam } = await searchParams;
  const anos = await anosDoPortal();
  const ano = anos.includes(Number(anoParam)) ? Number(anoParam) : anos[0];
  if (!ano) return <main className="mx-auto max-w-3xl p-8 text-slate-700">Nenhum exercício publicado ainda.</main>;
  const [linhas, etapas] = await Promise.all([dadosDoPortal(ano), nomesDasEtapas()]);
  return <PortalEmendas linhas={linhas} etapas={etapas} ano={ano} anos={anos} />;
}
