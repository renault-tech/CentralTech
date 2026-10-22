import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DetalheEmendaCliente } from "@/components/emendas/detalhe-emenda";
import { PainelParceria } from "@/components/emendas/painel-parceria";
import { Chip, LinhaEtapas, LinkVoltar } from "@/components/emendas/ui";
import { listarBeneficiarios, listarUnidades, obterCatalogoEtapas, obterContextoEmendas, obterDetalheEmenda, podeEditarSecretaria } from "@/lib/emendas/dados";
import { NOME_MODALIDADE, brl, dataBr, ehGestor, numeroVereador } from "@/lib/emendas/regras";
import { criarClienteEmendas } from "@/lib/supabase/emendas-cliente";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { EtapaEmenda } from "@/types/emendas";

export const dynamic = "force-dynamic";

export default async function PaginaEmenda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") redirect("/emendas");

  // Tudo o que não depende do resultado do detalhe anda na mesma rodada
  // (eram 3 etapas em cascata). A auditoria só é lida por gestor.
  const gestor = ehGestor(ctx.perfil);
  const [detalhe, catalogo, beneficiarios, unidades, auditoria] = await Promise.all([
    obterDetalheEmenda(id),
    obterCatalogoEtapas(),
    listarBeneficiarios(),
    listarUnidades(),
    gestor
      ? criarClienteEmendas().then((c) =>
          c.from("auditoria").select("*").in("tabela", ["emendas", "execucao"]).eq("registro_id", id).order("em", { ascending: false }).limit(50)
        )
      : Promise.resolve({ data: [] }),
  ]);
  if (!detalhe) notFound();
  const { emenda, andamentos, movimentos, execucao } = detalhe;
  const podeEditar = podeEditarSecretaria(ctx, emenda.secretaria_id);
  const registros = auditoria.data ?? [];
  const idsUsuarios = Array.from(new Set(registros.map((a) => a.usuario_id).filter((x): x is string => !!x)));
  const nomesUsuarios: Record<string, string> = {};
  if (idsUsuarios.length) {
    const hub = await criarClienteServidor();
    const { data } = await hub.from("usuarios").select("id,nome").in("id", idsUsuarios);
    for (const u of data ?? []) nomesUsuarios[u.id] = u.nome;
  }

  const rotulos: Partial<Record<EtapaEmenda, string>> = { indicada: `LOA ${emenda.ano}` };
  for (const a of andamentos.slice().reverse()) rotulos[a.etapa] = dataBr(a.data);
  const empenho = movimentos.find((m) => m.tipo === "empenho" && m.numero);
  if (empenho) rotulos.empenhada = `EMP ${empenho.numero}`;
  if (emenda.ultimo_pagamento) rotulos.paga = `em ${dataBr(emenda.ultimo_pagamento)}`;
  // Fases acompanhadas pela planilha de cumprimento: o dado vem do bloco de parceria.
  if (execucao?.numero_termo && !rotulos.termo_parceria) rotulos.termo_parceria = `nº ${execucao.numero_termo}`;
  if (execucao?.data_envio_pagamento && !rotulos.envio_pagamento) rotulos.envio_pagamento = `em ${dataBr(execucao.data_envio_pagamento)}`;

  return (
    <div className="flex flex-col gap-5">
      <LinkVoltar href={`/emendas/lista?ano=${emenda.ano}`}>Voltar para a lista</LinkVoltar>

      <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono font-medium text-violet-900">Emenda nº {emenda.numero}</span>
              <Chip tom="azul">{NOME_MODALIDADE[emenda.modalidade]}</Chip>
              {emenda.saude && <Chip tom="saude">Saúde</Chip>}
              {emenda.remanejada && <Chip tom="amarelo">Remanejada</Chip>}
              {emenda.situacao === "cancelada" && <Chip>Cancelada</Chip>}
            </div>
            <h1 className="text-2xl font-semibold leading-tight text-cataguases-marinho">{emenda.objeto}</h1>
            <p className="text-sm text-slate-600">
              {emenda.beneficiario_nome ? `${emenda.beneficiario_nome} · ` : ""}
              {emenda.secretaria_nome} ({emenda.unidade_codigo} {emenda.unidade_nome}) · Vereador(a){" "}
              <Link href={`/emendas/vereadores/${emenda.vereador_id}?ano=${emenda.ano}`} className="text-cataguases-azul hover:underline">
                {numeroVereador(emenda.vereador_numero)} · {emenda.vereador_nome}
              </Link>{" "}
              · {emenda.numero_vereador}ª emenda dele(a)
            </p>
          </div>
          <span className="text-3xl font-semibold tabular-nums text-cataguases-marinho">{brl(emenda.valor)}</span>
        </div>
        <LinhaEtapas modalidade={emenda.modalidade} etapa={emenda.etapa} situacao={emenda.situacao} rotulos={rotulos} catalogo={catalogo} />
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <DetalheEmendaCliente
            detalhe={detalhe}
            podeEditar={podeEditar}
            gestor={gestor}
            beneficiarios={beneficiarios}
            unidades={unidades}
            auditoria={registros}
            nomesUsuarios={nomesUsuarios}
          />
        </div>
        <aside className="flex flex-[1_1_300px] flex-col gap-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-cataguases-marinho">Dados orçamentários</h2>
            <dl className="flex flex-col gap-2.5 text-[13px]">
              {[
                ["Funcional programática", emenda.funcional_programatica],
                ["Natureza da despesa", emenda.natureza_despesa ? `${emenda.natureza_despesa} · ${NOME_MODALIDADE[emenda.modalidade].toLowerCase()}` : null],
                ["Nova dotação (ficha)", emenda.ficha],
                ["Unidade orçamentária", `${emenda.unidade_codigo} ${emenda.unidade_nome}`],
                ["Secretaria responsável", emenda.secretaria_nome],
                ["Beneficiário", emenda.beneficiario_nome ? `${emenda.beneficiario_nome}${emenda.beneficiario_cnpj ? ` · CNPJ ${emenda.beneficiario_cnpj}` : ""}` : null],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="mt-0.5 font-medium text-cataguases-marinho">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <PainelParceria emendaId={emenda.id} modalidade={emenda.modalidade} execucao={execucao} podeEditar={podeEditar} />
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-cataguases-marinho">Descrição completa</h2>
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700">{emenda.descricao}</p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-600">
            <h2 className="mb-1.5 text-sm font-semibold text-cataguases-marinho">Quem pode mexer</h2>
            Registram a execução: gestores e a equipe de <strong className="text-cataguases-marinho">{emenda.secretaria_nome}</strong> com permissão de
            edição. Valor, vereador e dotação só mudam por remanejamento, feito pelo gestor.
            <p className="mt-2 text-xs">{podeEditar ? "Você pode registrar andamentos nesta emenda." : "Você só visualiza esta emenda."}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
