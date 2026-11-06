import { ConsolidadoContas } from "@/components/imoveis/consolidado";

export const metadata = { title: "Água · Imóveis e Consumo" };

export default async function PaginaAgua({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ConsolidadoContas tipo="agua" searchParams={await searchParams} />;
}
