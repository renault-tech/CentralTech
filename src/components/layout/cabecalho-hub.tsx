import Link from "next/link";

import { Brasao } from "@/components/brasao";
import { BotaoAjuda } from "@/components/ajuda/botao-ajuda";
import { sair } from "@/lib/actions/auth";
import { contarSolicitacoesPendentes } from "@/lib/dados/solicitacoes";
import { Button } from "@/components/ui/button";
import type { UsuarioHub } from "@/types/database";

/**
 * Cabeçalho fixo do Hub — usado em TODAS as telas autenticadas (Início,
 * Configurações, Novidades), não só na Início. Antes cada página inventava
 * a própria navegação (ou não tinha nenhuma: Configurações não tinha
 * nenhum jeito de voltar sem o botão "Voltar" do navegador — achado real
 * testando como usuário). Clicar no brasão/nome sempre leva à Início
 * (mesmo padrão já aplicado dentro de cada módulo).
 */
export async function CabecalhoHub({ usuario }: { usuario: UsuarioHub }) {
  // Pedido do usuário: "preciso ser avisado no hub que há pedido pendente".
  // O selo fica no próprio link de Configurações (visível em toda tela) e
  // o link leva direto à lista de pedidos quando há algum.
  const pendentes = usuario.admin_hub ? await contarSolicitacoesPendentes() : 0;

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-cataguases-marinho px-4 py-3 text-white sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-3 transition-opacity hover:opacity-85"
        data-tour="marca-hub"
      >
        <Brasao tamanho={32} />
        <div>
          <p className="text-sm font-semibold leading-tight">Central Cataguases</p>
          <p className="text-[11px] leading-tight text-slate-300">Prefeitura de Cataguases</p>
        </div>
      </Link>
      <nav className="flex items-center gap-1 text-sm sm:gap-2">
        <Link
          href="/novidades"
          data-tour="link-novidades"
          className="hidden rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white sm:inline-block"
        >
          Novidades
        </Link>
        {usuario.admin_hub && (
          <Link
            href={pendentes > 0 ? "/configuracoes/solicitacoes" : "/configuracoes"}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            title={pendentes > 0 ? `${pendentes} pedido(s) de acesso aguardando decisão` : undefined}
          >
            Configurações
            {pendentes > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cataguases-vermelho px-1.5 text-[11px] font-semibold text-white">
                {pendentes}
                <span className="sr-only"> pedido(s) de acesso pendente(s)</span>
              </span>
            )}
          </Link>
        )}
        <BotaoAjuda />
        <Link
          href="/conta"
          className="hidden rounded-md px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:inline-block"
        >
          {usuario.nome}
        </Link>
        <form action={sair}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-slate-200 hover:bg-white/10 hover:text-white"
          >
            Sair
          </Button>
        </form>
      </nav>
    </header>
  );
}
