import { Inbox, ShieldAlert, Users } from "lucide-react";

import { IndiceConfiguracoes, type CartaoConfiguracao } from "@/components/layout/indice-configuracoes";
import { contarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";

export const dynamic = "force-dynamic";


/**
 * Índice de Configurações: um card por área, mesmo padrão já usado no
 * App-Compras. O gate de admin_hub já é feito no layout (`layout.tsx`),
 * então esta página só busca a contagem para o selo de "Solicitações"
 * (o único indicador acionável — usuários/bloqueio não têm
 * um "pendente" natural para destacar).
 */
export default async function PaginaConfiguracoes() {
  const pendentes = await contarSolicitacoesPendentes();

  const cards: CartaoConfiguracao[] = [
    {
      href: "/configuracoes/solicitacoes",
      titulo: "Solicitações de acesso",
      descricao: "Pedidos feitos em /solicitar-acesso — aprovar por app ou recusar.",
      Icone: Inbox,
      cor: "#2563A8",
      contagem: pendentes,
    },
    {
      href: "/configuracoes/usuarios",
      titulo: "Usuários e acessos",
      descricao: "Quem já tem conta, quais módulos vê, e quem é admin do hub.",
      Icone: Users,
      cor: "#639922",
    },
    {
      href: "/configuracoes/login-direto",
      titulo: "Login direto por aplicativo",
      descricao: "Sinal de quanto cada app já migrou, e o interruptor de bloqueio.",
      Icone: ShieldAlert,
      cor: "#D98614",
    },
  ];

  return <IndiceConfiguracoes cartoes={cards} colunas={2} />;
}
