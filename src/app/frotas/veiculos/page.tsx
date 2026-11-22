import Link from "next/link";

import { AreaVeiculos } from "@/components/frotas/areas-trabalho";
import { FormularioVeiculo } from "@/components/frotas/formulario-veiculo";
import { Cartao, CLASSE_BOTAO_SECUNDARIO, TituloPagina } from "@/components/frotas/ui";
import { montarLinhasVeiculos } from "@/lib/frotas/area-trabalho";
import { listarFornecedores, listarManutencoes, listarSecretarias, listarVeiculos, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { revisarVeiculos } from "@/lib/frotas/revisao";
import { dataNoFuso } from "@/lib/fuso";

export const maxDuration = 60;

export const metadata = { title: "Veículos · Frotas" };

export default async function PaginaVeiculos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [veiculos, secretarias, locadoras, manutencoes, params] = await Promise.all([listarVeiculos(), listarSecretarias(), listarFornecedores("locadora"), listarManutencoes(), obterParametros()]);

  const editarId = typeof sp.editar === "string" ? sp.editar : undefined;
  const editando = editarId ? (veiculos.find((v) => v.id === editarId) ?? null) : null;
  const abrirForm = gestor && (sp.novo === "1" || !!editando);

  if (!abrirForm) {
    const hoje = dataNoFuso(new Date());
    return <AreaVeiculos linhas={montarLinhasVeiculos({ hoje, veiculos, manutencoes, notas: [], secretarias, params })} gestor={gestor} />;
  }

  const avisos = revisarVeiculos(veiculos);
  const voltar = "/frotas/veiculos";
  return (
    <>
      <TituloPagina
        titulo={editando ? "Editar veículo" : "Novo veículo"}
        acao={
          <Link href={voltar} className={CLASSE_BOTAO_SECUNDARIO}>
            ← Voltar à lista
          </Link>
        }
      />
      <div className="max-w-3xl">
        <Cartao titulo={editando ? `${editando.placa ?? "Sem placa"} · ${editando.modelo}` : "Novo veículo"}>
          <FormularioVeiculo
            key={`${editando?.id ?? "novo"}-${editando?.atualizado_em ?? ""}`}
            veiculo={editando}
            secretarias={secretarias}
            locadoras={locadoras}
            avisos={editando ? (avisos.get(editando.id) ?? []) : []}
            voltarPara={voltar}
          />
        </Cartao>
      </div>
    </>
  );
}
