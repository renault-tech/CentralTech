import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox, ShieldAlert, UploadCloud, Users } from "lucide-react";

import { listarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";

export const dynamic = "force-dynamic";

type CardConfig = {
  href: string;
  titulo: string;
  descricao: string;
  Icone: LucideIcon;
  cor: string;
  contagem?: number;
};

/**
 * Índice de Configurações: um card por área, mesmo padrão já usado no
 * App-Compras. O gate de admin_hub já é feito no layout (`layout.tsx`),
 * então esta página só busca a contagem para o selo de "Solicitações"
 * (o único indicador acionável — usuários/importação/bloqueio não têm
 * um "pendente" natural para destacar).
 */
export default async function PaginaConfiguracoes() {
  const pendentes = await listarSolicitacoesPendentes();

  const cards: CardConfig[] = [
    {
      href: "/configuracoes/solicitacoes",
      titulo: "Solicitações de acesso",
      descricao: "Pedidos feitos em /solicitar-acesso — aprovar por app ou recusar.",
      Icone: Inbox,
      cor: "#2563A8",
      contagem: pendentes.length,
    },
    {
      href: "/configuracoes/usuarios",
      titulo: "Usuários e acessos",
      descricao: "Quem já tem conta, quais módulos vê, e quem é admin do hub.",
      Icone: Users,
      cor: "#639922",
    },
    {
      href: "/configuracoes/numera",
      titulo: "Importar do Numera",
      descricao: "Traz para o Hub quem já tem conta aprovada só lá.",
      Icone: UploadCloud,
      cor: "#7C3AED",
    },
    {
      href: "/configuracoes/login-direto",
      titulo: "Login direto por aplicativo",
      descricao: "Sinal de quanto cada app já migrou, e o interruptor de bloqueio.",
      Icone: ShieldAlert,
      cor: "#D98614",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group relative rounded-[20px] border border-[rgba(12,29,51,0.07)] bg-white/75 p-[18px] shadow-[0_2px_10px_rgba(12,29,51,0.04)] backdrop-blur-[10px] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul focus-visible:ring-offset-2"
        >
          {!!card.contagem && (
            <span className="absolute right-4 top-4 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cataguases-vermelho px-1.5 text-[11px] font-semibold text-white">
              {card.contagem}
            </span>
          )}
          <span
            className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px]"
            style={{ backgroundColor: `${card.cor}1F`, color: card.cor }}
          >
            <card.Icone className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-cataguases-marinho">{card.titulo}</p>
          <p className="mt-1 text-[13px] leading-[1.4] text-slate-500">{card.descricao}</p>
        </Link>
      ))}
    </div>
  );
}
