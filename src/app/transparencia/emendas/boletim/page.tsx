import { ConfirmarBoletim } from "@/components/transparencia/confirmar-boletim";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boletim das emendas · Transparência · Prefeitura de Cataguases", robots: { index: false } };

/** Confirmação/cancelamento do boletim. O GET só mostra o botão: antivírus e prévias de e-mail abrem o link sozinhos. */
export default async function PaginaBoletim({ searchParams }: { searchParams: Promise<{ acao?: string; t?: string }> }) {
  const { acao, t } = await searchParams;
  return <ConfirmarBoletim acao={acao === "cancelar" ? "cancelar" : "confirmar"} token={t ?? ""} />;
}
