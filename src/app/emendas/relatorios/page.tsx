import { MenuExportar } from "@/components/emendas/menu-exportar";
import { Vazio } from "@/components/emendas/ui";
import { resolverExercicio } from "@/lib/emendas/dados";
import { brl } from "@/lib/emendas/regras";
import { RELATORIOS, montarRelatorio } from "@/lib/emendas/relatorios-dados";

export const dynamic = "force-dynamic";

export default async function PaginaRelatorios({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Nenhum exercício cadastrado ainda.</Vazio>;
  const tabelas = await Promise.all(RELATORIOS.map((r) => montarRelatorio(r, exercicio.ano)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-cataguases-marinho">Relatórios de {exercicio.ano}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Dados de apoio à prestação de contas (IN TCE-MG 05/2025; LRF, art. 48-A; Lei 13.019/2014, arts. 38, 51 e 69; Lei 4.320/1964, arts. 58 a 65). O envio oficial segue o sistema do TCE-MG; aqui ficam os números prontos para conferir, imprimir ou baixar em CSV.
          </p>
        </div>
        <MenuExportar
          opcoes={[
            { rotulo: "Todos os relatórios (PDF)", detalhe: "Um arquivo com todas as tabelas", href: `/emendas/relatorios/pdf?ano=${exercicio.ano}` },
            { rotulo: "Imprimir / salvar esta página", detalhe: "Usa a impressão do navegador", imprimir: true },
          ]}
        />
      </div>
      {tabelas.map((t, i) => (
        <section key={t.titulo} className="rounded-xl border border-slate-200 bg-white p-4 print:break-inside-avoid print:border-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-cataguases-marinho">{t.titulo}</h2>
            <MenuExportar
              compacto
              opcoes={[
                { rotulo: "PDF", href: `/emendas/relatorios/pdf?r=${RELATORIOS[i]}&ano=${exercicio.ano}` },
                { rotulo: "CSV (planilha)", href: `/emendas/relatorios/csv?r=${RELATORIOS[i]}&ano=${exercicio.ano}` },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  {t.colunas.map((c, j) => (
                    <th key={c} scope="col" className={`px-3 py-2 font-medium ${t.monetarias.includes(j) ? "text-right" : ""}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.linhas.map((l, k) => (
                  <tr key={k} className="border-t border-slate-100">
                    {l.map((v, j) => (
                      <td key={j} className={`px-3 py-2 ${t.monetarias.includes(j) ? "text-right tabular-nums" : ""}`}>
                        {typeof v === "number" && t.monetarias.includes(j) ? brl(v) : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {t.linhas.length === 0 && <p className="py-3 text-sm text-slate-500">Nada a relatar.</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
