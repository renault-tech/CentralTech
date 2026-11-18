import { redirect } from "next/navigation";

/** A tela de saldos virou o Panorama da execução (mesmos saldos, mais o cenário completo). */
export default async function PaginaSaldos({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  redirect(ano ? `/emendas/panorama?ano=${encodeURIComponent(ano)}` : "/emendas/panorama");
}
