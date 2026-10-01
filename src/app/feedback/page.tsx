import Link from "next/link";
import { redirect } from "next/navigation";

import { CabecalhoHub } from "@/components/layout/cabecalho-hub";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { CartaoFeedback } from "@/components/feedback/cartao-feedback";
import { obterUsuarioAtual } from "@/lib/auth/perfil";
import { listarFeedbackGestao, listarMeusFeedbacks, podeGerirFeedback, STATUS_PENDENTES } from "@/lib/dados/feedback";
import { APPS_FEEDBACK, ORDEM_APPS, ROTULO_STATUS, ROTULO_TIPO } from "@/lib/feedback/apps";
import { cn, ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import type { AppFeedback, StatusFeedback, TipoFeedback } from "@/types/database";

export const dynamic = "force-dynamic";

type Busca = { aba?: string; app?: string; tipo?: string; status?: string };

/**
 * Feedback central. Quem gerencia (admin do Hub; admin/diretor do Compras)
 * vê tudo, com o app de origem em cor própria, e a aba "Meus envios".
 * Os demais só têm "Meus envios" (histórico + status do que mandaram).
 */
export default async function PaginaFeedback({ searchParams }: { searchParams: Promise<Busca> }) {
  const [usuario, busca, gerencia] = await Promise.all([obterUsuarioAtual(), searchParams, podeGerirFeedback()]);
  if (!usuario) redirect("/login");

  const aba = gerencia && busca.aba !== "meus" ? "gestao" : "meus";
  const app = ORDEM_APPS.includes(busca.app as AppFeedback) ? (busca.app as AppFeedback) : undefined;
  const tipo = busca.tipo === "suporte" || busca.tipo === "sugestao" ? (busca.tipo as TipoFeedback) : undefined;
  // Padrão da gestão: só o que ainda não foi resolvido. "todos" ou um status
  // específico no filtro mostra o resto.
  const filtroStatus = busca.status ?? "pendentes";
  const status: StatusFeedback | StatusFeedback[] | undefined =
    filtroStatus === "pendentes"
      ? STATUS_PENDENTES
      : filtroStatus === "todos"
        ? undefined
        : filtroStatus in ROTULO_STATUS
          ? (filtroStatus as StatusFeedback)
          : STATUS_PENDENTES;

  const itens =
    aba === "gestao" ? await listarFeedbackGestao({ app, tipo, status }) : await listarMeusFeedbacks(usuario.id);

  return (
    <div className="min-h-dvh bg-slate-50">
      <CabecalhoHub usuario={usuario} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <CabecalhoPagina
          titulo="Feedback"
          subtitulo={aba === "gestao" ? "Sugestões e pedidos de suporte de todos os aplicativos." : "O que você enviou e como está cada pedido."}
        />

        {gerencia && (
          <nav className="mt-6 flex gap-1 border-b border-slate-200" aria-label="Feedback">
            {[
              { href: "/feedback", rotulo: "Todos os apps", ativa: aba === "gestao" },
              { href: "/feedback?aba=meus", rotulo: "Meus envios", ativa: aba === "meus" },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                aria-current={a.ativa ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  a.ativa ? "border-cataguases-azul font-medium text-cataguases-marinho" : "border-transparent text-slate-500 hover:text-cataguases-marinho"
                )}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
        )}

        {aba === "gestao" && (
          <form method="get" className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            {[
              { name: "app", rotulo: "Aplicativo", valor: busca.app, opcoes: ORDEM_APPS.map((a) => [a, APPS_FEEDBACK[a].nome]) },
              { name: "tipo", rotulo: "Tipo", valor: busca.tipo, opcoes: Object.entries(ROTULO_TIPO) },
              {
                name: "status",
                rotulo: "Status",
                valor: filtroStatus,
                semTodos: true,
                opcoes: [["pendentes", "Pendentes (novo + em análise)"], ["todos", "Todos"], ...Object.entries(ROTULO_STATUS)],
              },
            ].map((c) => (
              <div key={c.name} className="flex flex-col gap-1">
                <label htmlFor={`f-${c.name}`} className="text-xs text-slate-500">{c.rotulo}</label>
                <select id={`f-${c.name}`} name={c.name} defaultValue={c.valor ?? ""} className={ESTILO_CAMPO}>
                  {!("semTodos" in c) && <option value="">Todos</option>}
                  {c.opcoes.map(([v, r]) => (
                    <option key={v} value={v}>{r}</option>
                  ))}
                </select>
              </div>
            ))}
            <button type="submit" className="rounded-md bg-cataguases-marinho px-4 py-1.5 text-sm font-medium text-white hover:bg-cataguases-marinho/90">
              Filtrar
            </button>
            {(app || tipo || filtroStatus !== "pendentes") && (
              <Link href="/feedback" className="text-sm text-slate-500 hover:underline">Limpar</Link>
            )}
          </form>
        )}

        <p className="mt-4 text-xs text-slate-500">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
          {aba === "gestao" && filtroStatus === "pendentes" && " pendentes — use o filtro Status para ver os resolvidos"}
        </p>
        <div className="mt-2 space-y-3">
          {itens.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
              {aba === "gestao" ? "Nenhum feedback para os filtros escolhidos." : "Você ainda não enviou nenhum feedback."}
            </div>
          ) : (
            itens.map((item) => <CartaoFeedback key={item.id} item={item} gerir={aba === "gestao"} />)
          )}
        </div>
      </main>
    </div>
  );
}
