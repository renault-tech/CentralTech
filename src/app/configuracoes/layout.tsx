import { redirect } from "next/navigation";

import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { AbasNavegacao } from "@/components/layout/abas-navegacao";

export const dynamic = "force-dynamic";

/**
 * Antes /configuracoes era uma única página empilhando as 4 seções
 * (Solicitações, Usuários, Importar do Numera, Login direto) — em
 * qualquer tela normal era preciso rolar bastante para chegar na última.
 * Virou um hub de cards (mesmo padrão já usado no App-Compras:
 * `configuracoes/layout.tsx` + `AbasNavegacao`) com uma sub-rota por área;
 * a faixa de abas deixa trocar de área direto, sem precisar voltar ao
 * índice de cards.
 */
export default async function LayoutConfiguracoes({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (!usuario.admin_hub) redirect("/");

  return (
    <div className="min-h-dvh bg-slate-50">
      <CabecalhoHub usuario={usuario} />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <CabecalhoPagina
          titulo="Configurações"
          subtitulo="Quem tem acesso ao hub e quais cards de módulo cada pessoa vê."
        />

        <div className="mt-6">
          <AbasNavegacao
            label="Configurações"
            abas={[
              { href: "/configuracoes/solicitacoes", rotulo: "Solicitações" },
              { href: "/configuracoes/usuarios", rotulo: "Usuários e acessos" },
              { href: "/configuracoes/numera", rotulo: "Importar do Numera" },
              { href: "/configuracoes/login-direto", rotulo: "Login direto" },
            ]}
          />
        </div>

        <div className="mt-5">{children}</div>
      </main>
    </div>
  );
}
