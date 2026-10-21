import { redirect } from "next/navigation";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { FormularioEmenda } from "@/components/emendas/formulario-emenda";
import { Vazio } from "@/components/emendas/ui";
import {
  listarBeneficiarios,
  listarEmendas,
  listarSecretarias,
  listarUnidades,
  listarVereadores,
  obterContextoEmendas,
  resolverExercicio,
} from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

export default async function PaginaNovaEmenda({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) redirect("/emendas");
  const { ano } = await searchParams;
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) return <Vazio>Cadastre o exercício em Configurações antes de lançar emendas.</Vazio>;

  const [emendas, vereadores, unidades, secretarias, beneficiarios] = await Promise.all([
    listarEmendas(exercicio.ano),
    listarVereadores(),
    listarUnidades(),
    listarSecretarias(),
    listarBeneficiarios(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina titulo="Nova emenda" subtitulo={`Exercício ${exercicio.ano}`} />
      <FormularioEmenda
        exercicio={exercicio}
        emendasDoAno={emendas}
        vereadores={vereadores.filter((v) => v.ativo)}
        unidades={unidades.filter((u) => u.ativo)}
        secretarias={secretarias}
        beneficiarios={beneficiarios}
      />
    </div>
  );
}
