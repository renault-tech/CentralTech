import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { SolicitarAcessoForm } from "@/components/solicitar-acesso-form";
import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { MODULOS } from "@/lib/modulos-info";
import type { Modulo } from "@/types/database";

export const metadata: Metadata = {
  title: "Solicitar acesso · Central Cataguases",
  description: "Peça acesso a Compras, Numera ou Requerimentos da Câmara.",
};

export const dynamic = "force-dynamic";

function moduloValido(valor: string | undefined): Modulo | undefined {
  return valor !== undefined && valor in MODULOS ? (valor as Modulo) : undefined;
}

export default async function PaginaSolicitarAcesso({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string }>;
}) {
  // Quem chega aqui já logado (card "sem acesso" do início) não precisa
  // redigitar nome/e-mail — o Hub já sabe quem é. Anônimo continua
  // funcionando normal (é o caminho de quem nunca teve conta nenhuma).
  const [usuario, { modulo }] = await Promise.all([obterUsuarioAtual(), searchParams]);

  return (
    <MolduraAuth
      titulo="Solicitar acesso"
      subtitulo="Compras, Numera e Requerimentos da Câmara em um só pedido"
    >
      <SolicitarAcessoForm
        valoresIniciais={{
          nome: usuario?.nome,
          email: usuario?.email,
          modulo: moduloValido(modulo),
        }}
      />
    </MolduraAuth>
  );
}
