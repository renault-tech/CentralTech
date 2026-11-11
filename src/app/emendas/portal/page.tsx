import Link from "next/link";

import { PainelPortalPublico } from "@/components/emendas/painel-portal-publico";
import { Vazio } from "@/components/emendas/ui";
import { obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { metaDoPortal, pacoteDoPortal } from "@/lib/emendas/portal";
import { verificarPortal } from "@/lib/emendas/portal-verificacao";
import { ehGestor } from "@/lib/emendas/regras";
import { origemDaRequisicao } from "@/lib/origem";
import { criarClienteAdminBruto } from "@/lib/supabase/admin";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";

export const dynamic = "force-dynamic";

/**
 * "Portal público" dentro do módulo: o que vai ao ar, os alertas antes de publicar, o link para o
 * site da Prefeitura e o botão de publicar. Os alertas olham exatamente as linhas do portal.
 */
export default async function PaginaPortalPublico({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const [ctx, { exercicio, exercicios }] = await Promise.all([obterContextoEmendas(), resolverExercicio(ano)]);
  if (!exercicio || ctx.situacao !== "ok") return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const gestor = ehGestor(ctx.perfil);

  const [pacote, meta, origem, { data: ids }] = await Promise.all([
    pacoteDoPortal(exercicio.ano),
    metaDoPortal(exercicio.ano),
    origemDaRequisicao(),
    (await criarClienteEmendas()).from("v_emendas").select("id,numero").eq("ano", exercicio.ano),
  ]);
  if (!meta) return <Vazio>Exercício não encontrado.</Vazio>;
  const alertas = verificarPortal(pacote.linhas, meta);
  const idPorNumero = Object.fromEntries((ids ?? []).map((e) => [e.numero as number, e.id as string]));

  let assinantes: { confirmados: number; pendentes: number } | null = null;
  if (gestor) {
    const db = criarClienteAdminBruto().schema("emendas");
    const [c, p] = await Promise.all([
      db.from("portal_assinantes").select("id", { count: "exact", head: true }).not("confirmado_em", "is", null).is("cancelado_em", null),
      db.from("portal_assinantes").select("id", { count: "exact", head: true }).is("confirmado_em", null).is("cancelado_em", null),
    ]);
    assinantes = { confirmados: c.count ?? 0, pendentes: p.count ?? 0 };
  }

  return (
    <div className="flex flex-col gap-6">
      {exercicios.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Exercício">
          {exercicios.map((e) => (
            <Link
              key={e.ano}
              href={`/emendas/portal?ano=${e.ano}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${e.ano === exercicio.ano ? "bg-[var(--modulo-texto)] text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {e.ano}
              {e.portal_publicado_em ? " · publicado" : ""}
            </Link>
          ))}
        </nav>
      )}
      <PainelPortalPublico
        ano={exercicio.ano}
        podePublicar={ctx.usuario.admin_hub}
        publicadoEm={exercicio.portal_publicado_em}
        ciencia={exercicio.portal_ciencia}
        urlPublica={`${origem}/transparencia/emendas`}
        alertas={alertas}
        idPorNumero={idPorNumero}
        totalEmendas={pacote.linhas.length}
        assinantes={assinantes}
        geradoEm={pacote.geradoEm}
      />
    </div>
  );
}
