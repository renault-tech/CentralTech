import Link from "next/link";

import { AreaCombustivel } from "@/components/frotas/areas-trabalho";
import { FormularioNota } from "@/components/frotas/formulario-nota";
import { Cartao, CLASSE_BOTAO_SECUNDARIO, TituloPagina } from "@/components/frotas/ui";
import { montarLinhasNotas } from "@/lib/frotas/area-trabalho";
import { listarFornecedores, listarNotas, listarSecretarias, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { formatarData, quinzenasRecentes } from "@/lib/frotas/regras";
import { dataNoFuso } from "@/lib/fuso";

export const metadata = { title: "Combustível · Frotas" };

export default async function PaginaCombustivel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [notas, secretarias, postos, params] = await Promise.all([listarNotas(), listarSecretarias(), listarFornecedores("posto"), obterParametros()]);
  const hoje = dataNoFuso(new Date());

  const editarId = typeof sp.editar === "string" ? sp.editar : undefined;
  const editando = editarId ? (notas.find((n) => n.id === editarId) ?? null) : null;
  const abrirForm = gestor && (sp.novo === "1" || !!editando);

  if (!abrirForm) {
    return <AreaCombustivel linhas={montarLinhasNotas({ hoje, veiculos: [], manutencoes: [], notas, secretarias, params, postos })} gestor={gestor} />;
  }

  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const quinzenas = quinzenasRecentes(hoje, 12).map((q) => ({ inicio: q.inicio, rotulo: q.rotulo }));
  if (editando && !quinzenas.some((q) => q.inicio === editando.periodo_inicio)) {
    quinzenas.push({ inicio: editando.periodo_inicio, rotulo: `${formatarData(editando.periodo_inicio)} a ${formatarData(editando.periodo_fim)}` });
  }
  const voltar = "/frotas/combustivel";

  return (
    <>
      <TituloPagina
        titulo={editando ? "Editar NF de combustível" : "Lançar NF de combustível"}
        acao={
          <Link href={voltar} className={CLASSE_BOTAO_SECUNDARIO}>
            ← Voltar à lista
          </Link>
        }
      />
      <div className="max-w-3xl">
        <Cartao titulo={editando ? `NF ${editando.numero_nf} · ${nomeSecretaria.get(editando.secretaria_id) ?? ""}` : "Lançar NF de combustível"}>
          <FormularioNota key={editando?.id ?? "nova"} nota={editando} secretarias={secretarias} postos={postos} quinzenas={quinzenas} dataHoje={hoje} voltarPara={voltar} />
        </Cartao>
      </div>
    </>
  );
}
