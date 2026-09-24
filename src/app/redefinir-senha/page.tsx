import type { Metadata } from "next";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { FormularioRedefinir } from "@/components/redefinir-form";
import { GuardaRecuperacao } from "@/components/guarda-recuperacao";

export const metadata: Metadata = {
  title: "Redefinir senha · Central Cataguases",
  description: "Definição de nova senha do painel central da Prefeitura de Cataguases.",
};

export const dynamic = "force-dynamic";

export default function PaginaRedefinirSenha() {
  return (
    <MolduraAuth titulo="Definir nova senha" subtitulo="Escolha uma nova senha para a sua conta">
      <GuardaRecuperacao>
        <FormularioRedefinir />
      </GuardaRecuperacao>
    </MolduraAuth>
  );
}
