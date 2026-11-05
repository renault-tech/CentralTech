import Link from "next/link";
import { ArrowLeft, Inbox, LogOut, Settings } from "lucide-react";

import { Brasao } from "@/components/brasao";
import { AlternarTema } from "@/components/layout/alternar-tema";
import { BotaoAjuda } from "@/components/ajuda/botao-ajuda";
import { sair } from "@/lib/actions/auth";
import { contarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";
import { contarFeedbackNovos, podeGerirFeedback } from "@/lib/dados/feedback";
import { BotaoFeedback } from "@/components/feedback/botao-feedback";
import { SinoNotificacoes } from "@/components/notificacoes/sino";
import { CLASSE_CONTADOR_CABECALHO, CLASSE_LINK_CABECALHO } from "@/components/layout/cabecalho-estilos";
import { SincronizarPreferencias } from "@/components/layout/sincronizar-preferencias";
import { lerPreferencias } from "@/lib/dados/preferencias";
import type { UsuarioHub } from "@/types/database";

/**
 * Cabeçalho do Hub — usado em TODAS as telas autenticadas (Início, Configurações, Novidades e os
 * módulos). Padrão único: faixa de 3 px na cor do módulo, brasão, "← Central" e o nome do módulo à
 * esquerda; à direita, nesta ordem: Novidades, Configurações, Feedback (gestão) · sino, megafone,
 * ajuda · usuário, Sair. Todos os controles saem de `cabecalho-estilos.ts`. Antes cada página inventava
 * a própria navegação (ou não tinha nenhuma: Configurações não tinha
 * nenhum jeito de voltar sem o botão "Voltar" do navegador — achado real
 * testando como usuário). Clicar no brasão/nome sempre leva à Início
 * (mesmo padrão já aplicado dentro de cada módulo).
 */
export async function CabecalhoHub({
  usuario,
  modulo,
}: {
  usuario: UsuarioHub;
  /** Módulo interno (Emendas, Frotas): faixa do topo na cor dele e o nome do módulo ao lado de
   * "← Central" — mesmo padrão de header de todos os apps (faixa de 3px na cor do app). */
  modulo?: { nome: string; cor: string; app?: "emendas" | "frotas" };
}) {
  // Pedido do usuário: "preciso ser avisado no hub que há pedido pendente". O selo fica no próprio
  // link de Configurações (visível em toda tela) e o link leva direto à lista de pedidos.
  // Quem não é admin do Hub pode gerir feedback (admin/diretor do Compras), então a contagem de
  // feedback roda junto e é descartada para quem não gerencia.
  const [pendentes, gerenciaFeedback, feedbackContado, preferencias] = await Promise.all([
    usuario.admin_hub ? contarSolicitacoesPendentes() : Promise.resolve(0),
    podeGerirFeedback(),
    contarFeedbackNovos(),
    lerPreferencias(),
  ]);
  return (
    <>
      <SincronizarPreferencias salvas={preferencias} />
      <CabecalhoVisual
        usuario={usuario}
        modulo={modulo}
        pendentes={pendentes}
        gerenciaFeedback={gerenciaFeedback}
        feedbackNovos={gerenciaFeedback ? feedbackContado : 0}
      />
    </>
  );
}

/** A parte visual do cabeçalho, sem acesso a dados (por isso dá para renderizá-la em teste de tela). */
export function CabecalhoVisual({
  usuario,
  modulo,
  pendentes,
  gerenciaFeedback,
  feedbackNovos,
}: {
  usuario: Pick<UsuarioHub, "id" | "nome" | "admin_hub">;
  modulo?: { nome: string; cor: string; app?: "emendas" | "frotas" };
  pendentes: number;
  gerenciaFeedback: boolean;
  feedbackNovos: number;
}) {
  return (
    <header
      className="cabecalho-escuro tema-fixo relative border-b border-t-[3px] border-b-slate-200 border-t-[#E9A63B] bg-cataguases-marinho text-white print:hidden"
      style={modulo ? { borderTopColor: modulo.cor } : undefined}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-cataguases-marinho"
      >
        Pular para o conteúdo
      </a>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
        {modulo ? (
          /* Dentro de um módulo: brasão, "← Central" (volta à Central) e o nome do módulo com a cor dele. */
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link href="/" aria-label="Central Cataguases, início" className="rounded-lg p-0.5 transition-opacity duration-200 hover:opacity-85" data-tour="marca-hub">
              <Brasao tamanho={32} />
            </Link>
            <Link href="/" aria-label="Voltar para a Central" className={`${CLASSE_LINK_CABECALHO} border border-white/20 pl-2.5`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Central
            </Link>
            <span aria-hidden className="hidden h-6 w-px bg-white/20 sm:block" />
            <p className="flex min-w-0 items-center gap-2 text-base font-semibold leading-tight">
              <span aria-hidden className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: modulo.cor }} />
              <span className="truncate">{modulo.nome}</span>
            </p>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-3 rounded-lg transition-opacity duration-200 hover:opacity-85" data-tour="marca-hub">
            <Brasao tamanho={32} />
            <div>
              <p className="text-sm font-semibold leading-tight">Central Cataguases</p>
              <p className="text-[11px] leading-tight text-slate-300">Prefeitura de Cataguases</p>
            </div>
          </Link>
        )}

        <nav aria-label="Avisos e conta" className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1">
          <Link href="/novidades" data-tour="link-novidades" className={`${CLASSE_LINK_CABECALHO} hidden sm:inline-flex`}>
            Novidades
          </Link>
          {usuario.admin_hub && (
            <Link
              href={pendentes > 0 ? "/configuracoes/solicitacoes" : "/configuracoes"}
              className={CLASSE_LINK_CABECALHO}
              title={pendentes > 0 ? `${pendentes} pedido(s) de acesso aguardando decisão` : undefined}
            >
              <Settings className="h-5 w-5 md:hidden" aria-hidden strokeWidth={1.8} />
              <span className="sr-only md:not-sr-only">Configurações</span>
              {pendentes > 0 && (
                <span className={CLASSE_CONTADOR_CABECALHO}>
                  {pendentes}
                  <span className="sr-only"> pedido(s) de acesso pendente(s)</span>
                </span>
              )}
            </Link>
          )}
          {gerenciaFeedback && (
            <Link
              href="/feedback"
              className={CLASSE_LINK_CABECALHO}
              title={feedbackNovos > 0 ? `${feedbackNovos} feedback(s) novo(s)` : undefined}
            >
              <Inbox className="h-5 w-5 md:hidden" aria-hidden strokeWidth={1.8} />
              <span className="sr-only md:not-sr-only">Feedback</span>
              {feedbackNovos > 0 && (
                <span className={CLASSE_CONTADOR_CABECALHO}>
                  {feedbackNovos}
                  <span className="sr-only"> feedback(s) novo(s)</span>
                </span>
              )}
            </Link>
          )}
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <SinoNotificacoes usuarioId={usuario.id} />
          <BotaoFeedback appInicial={modulo?.app ?? "hub"} />
          <BotaoAjuda />
          <AlternarTema />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
          <Link href="/conta" className={`${CLASSE_LINK_CABECALHO} hidden max-w-[14rem] sm:inline-flex`} title="Minha conta">
            <span className="truncate">{usuario.nome}</span>
          </Link>
          <form action={sair}>
            <button type="submit" className={CLASSE_LINK_CABECALHO}>
              <LogOut className="h-5 w-5 sm:hidden" aria-hidden strokeWidth={1.8} />
              <span className="sr-only sm:not-sr-only">Sair</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
