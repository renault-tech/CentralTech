import { ConsolidadoContas } from "@/components/imoveis/consolidado";

export const metadata = { title: "Luz · Imóveis e Consumo" };

export default async function PaginaLuz({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ConsolidadoContas tipo="luz" searchParams={await searchParams} />;
}
