import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { SolicitarAcessoForm } from "@/components/solicitar-acesso-form";

export const metadata: Metadata = {
  title: "Solicitar acesso · Central Cataguases",
  description: "Peça acesso a Compras, Numera ou Requerimentos da Câmara.",
};

export const dynamic = "force-dynamic";

export default function PaginaSolicitarAcesso() {
  return (
    <MolduraAuth
      titulo="Solicitar acesso"
      subtitulo="Compras, Numera e Requerimentos da Câmara em um só pedido"
    >
      <SolicitarAcessoForm />
    </MolduraAuth>
  );
}
