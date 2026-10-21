import { notFound, redirect } from "next/navigation";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { FormularioEmenda } from "@/components/emendas/formulario-emenda";
import { LinkVoltar } from "@/components/emendas/ui";
import {
  listarBeneficiarios,
  listarEmendas,
  listarExercicios,
  listarSecretarias,
  listarUnidades,
  listarVereadores,
  obterContextoEmendas,
  obterDetalheEmenda,
} from "@/lib/emendas/dados";
import { ehGestor } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

/** Correção de cadastro (erro de digitação, ficha, CNPJ…). Mudança de
 * destinação/dotação de verdade é remanejamento — botão no detalhe —, que
 * guarda o antes/depois com ato e motivo. Esta tela também fica no
 * registro de alterações (auditoria), só que sem ato/motivo. */
export default async function PaginaEditarEmenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok" || !ehGestor(ctx.perfil)) redirect(`/emendas/${id}`);
  const detalhe = await obterDetalheEmenda(id);
  if (!detalhe) notFound();
  const { emenda } = detalhe;

  const [exercicios, emendas, vereadores, unidades, secretarias, beneficiarios] = await Promise.all([
    listarExercicios(),
    listarEmendas(emenda.ano),
    listarVereadores(),
    listarUnidades(),
    listarSecretarias(),
    listarBeneficiarios(),
  ]);
  const exercicio = exercicios.find((e) => e.ano === emenda.ano);
  if (!exercicio) notFound();

  return (
    <div className="flex flex-col gap-5">
      <LinkVoltar href={`/emendas/${id}`}>Voltar para a emenda</LinkVoltar>
      <CabecalhoPagina
        titulo={`Corrigir cadastro · emenda nº ${emenda.numero}`}
        subtitulo="Para mudar destinação ou dotação com ato e motivo, use “Remanejar” no detalhe da emenda."
      />
      <FormularioEmenda
        exercicio={exercicio}
        emendasDoAno={emendas}
        vereadores={vereadores}
        unidades={unidades}
        secretarias={secretarias}
        beneficiarios={beneficiarios}
        emenda={emenda}
      />
    </div>
  );
}
