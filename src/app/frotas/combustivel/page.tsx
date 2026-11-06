import Link from "next/link";

import { FormularioFiltros } from "@/components/modulo/formulario-filtros";

import { FormularioNota } from "@/components/frotas/formulario-nota";
import { Cartao, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Selo, SeloDias, TituloPagina, Vazio } from "@/components/frotas/ui";
import { filtrarNotas, lerFiltroNotas } from "@/lib/frotas/filtros";
import { listarFornecedores, listarNotas, listarSecretarias, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { brl, formatarData, nivelPorDias, quinzenasRecentes, situacaoNota, diasEntre, type EtapaNota } from "@/lib/frotas/regras";
import { montarUrl } from "@/lib/frotas/url";
import { dataNoFuso } from "@/lib/fuso";
import { MenuExportarFrotas } from "@/components/frotas/menu-exportar-frotas";
import { opcoesExportar } from "@/lib/frotas/exportacao";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

export const metadata = { title: "Combustível · Frotas" };

const TOM_ETAPA: Record<EtapaNota, "neutro" | "azul" | "verde" | "ambar"> = {
  recebida: "neutro",
  com_secretaria: "ambar",
  assinada: "azul",
  na_contabilidade: "verde",
};

export default async function PaginaCombustivel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [notas, secretarias, postos, params] = await Promise.all([listarNotas(), listarSecretarias(), listarFornecedores("posto"), obterParametros()]);
  const hoje = dataNoFuso(new Date());

  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const nomePosto = new Map(postos.map((p) => [p.id, p.nome]));
  const filtro = lerFiltroNotas(sp);
  const lista = filtrarNotas(notas, filtro, hoje, { secretarias: nomeSecretaria, fornecedores: nomePosto });

  const editarId = typeof sp.editar === "string" ? sp.editar : undefined;
  const editando = editarId ? (notas.find((n) => n.id === editarId) ?? null) : null;
  const abrirForm = gestor && (sp.novo === "1" || !!editando);

  const quinzenas = quinzenasRecentes(hoje, 12).map((q) => ({ inicio: q.inicio, rotulo: q.rotulo }));
  if (editando && !quinzenas.some((q) => q.inicio === editando.periodo_inicio)) {
    const q = notas.find((n) => n.id === editando.id)!;
    quinzenas.push({ inicio: q.periodo_inicio, rotulo: `${formatarData(q.periodo_inicio)} a ${formatarData(q.periodo_fim)}` });
  }

  const base = { q: filtro.q, sec: filtro.secretaria, quinz: filtro.quinzena, sit: filtro.situacao };
  const voltar = montarUrl("/frotas/combustivel", base);
  const total = lista.reduce((a, n) => a + n.valor, 0);

  return (
    <>
      <TituloPagina
        titulo="Notas fiscais de combustível"
        subtitulo="Uma NF por secretaria a cada 15 dias. Litros e veículos ficam no sistema de abastecimento; aqui só o controle do documento."
        acao={
          <>
            <MenuExportarFrotas
              opcoes={opcoesExportar(
                [
                  { r: "combustivel", rotulo: "NFs da lista", formatos: ["xlsx", "pdf", "csv"] },
                  { r: "contabilidade", rotulo: "Remessa à Contabilidade", formatos: ["pdf"] },
                ],
                base
              )}
            />
            {gestor && (
              <Link href={montarUrl("/frotas/combustivel", { ...base, novo: "1" })} className={CLASSE_BOTAO}>
                Lançar NF
              </Link>
            )}
          </>
        }
      />

      <div className={abrirForm ? "grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(340px,1.1fr)]" : ""}>
        <Cartao semPadding>
          <FormularioFiltros className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5" limpar={{ href: "/frotas/combustivel", className: CLASSE_BOTAO_SECUNDARIO }}>
            <div className="flex min-w-[200px] flex-[2] flex-col gap-1">
              <label htmlFor="f-q" className="text-xs font-semibold text-slate-600">Buscar</label>
              <input id="f-q" name="q" defaultValue={filtro.q} placeholder="Nº da NF, secretaria ou posto" className={ESTILO_CAMPO_PADRAO} />
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1">
              <label htmlFor="f-sec" className="text-xs font-semibold text-slate-600">Secretaria</label>
              <select id="f-sec" name="sec" defaultValue={filtro.secretaria ?? ""} className={ESTILO_CAMPO_PADRAO}>
                <option value="">Todas</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[150px] flex-1 flex-col gap-1">
              <label htmlFor="f-quinz" className="text-xs font-semibold text-slate-600">Quinzena</label>
              <select id="f-quinz" name="quinz" defaultValue={filtro.quinzena ?? ""} className={ESTILO_CAMPO_PADRAO}>
                <option value="">Todas</option>
                {quinzenas.map((q) => (
                  <option key={q.inicio} value={q.inicio}>{q.rotulo}</option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[170px] flex-1 flex-col gap-1">
              <label htmlFor="f-sit" className="text-xs font-semibold text-slate-600">Situação</label>
              <select id="f-sit" name="sit" defaultValue={filtro.situacao ?? ""} className={ESTILO_CAMPO_PADRAO}>
                <option value="">Em andamento</option>
                <option value="recebida">Recebida, a enviar à secretaria</option>
                <option value="com_secretaria">Aguardando assinatura</option>
                <option value="assinada">Assinada, a enviar à Contabilidade</option>
                <option value="na_contabilidade">Na Contabilidade</option>
                <option value="todas">Todas (inclui as antigas)</option>
              </select>
            </div>
          </FormularioFiltros>

          {lista.length === 0 ? (
            <Vazio>Nenhuma NF encontrada com esses filtros.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    {["Secretaria", "NF", "Emissão", "Valor", "Enviada", "Retornou", "Contabilidade", "Situação"].map((t) => (
                      <th key={t} scope="col" className="px-4 py-2.5 first:sm:pl-5">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((n) => {
                    const s = situacaoNota(n);
                    const dias = diasEntre(s.desde, hoje);
                    const nivel = s.pendente && s.etapa !== "recebida" ? nivelPorDias(dias, params) : "ok";
                    return (
                      <tr key={n.id} className={`border-t border-slate-100 hover:bg-slate-50 ${editando?.id === n.id ? "bg-[#F7FAF0]" : ""}`}>
                        <td className="px-4 py-2.5 font-medium text-cataguases-marinho sm:pl-5">{nomeSecretaria.get(n.secretaria_id) ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Link href={montarUrl("/frotas/combustivel", { ...base, editar: n.id })} className="font-semibold text-cataguases-marinho hover:underline">
                            {n.numero_nf}
                          </Link>
                          <span className="block text-xs text-slate-500">{formatarData(n.periodo_inicio).slice(0, 5)} a {formatarData(n.periodo_fim).slice(0, 5)}</span>
                        </td>
                        <td className="px-4 py-2.5">{formatarData(n.data_emissao)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{brl(n.valor)}</td>
                        <td className="px-4 py-2.5">{formatarData(n.enviada_secretaria_em)}</td>
                        <td className="px-4 py-2.5">{formatarData(n.retornou_em)}</td>
                        <td className="px-4 py-2.5">{formatarData(n.enviada_contabilidade_em)}</td>
                        <td className="px-4 py-2.5">
                          {s.pendente && s.etapa !== "recebida" && nivel !== "ok" ? (
                            <SeloDias dias={dias} nivel={nivel} />
                          ) : (
                            <Selo tom={TOM_ETAPA[s.etapa]}>{s.rotulo}</Selo>
                          )}
                          {s.pendente && s.etapa !== "recebida" && nivel !== "ok" && <span className="mt-1 block text-xs text-slate-500">{s.rotulo}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            {lista.length} {lista.length === 1 ? "NF" : "NFs"} · {brl(total)}. As que já foram à Contabilidade há mais de 30 dias saem desta lista e continuam na busca (“Todas”).
          </p>
        </Cartao>

        {abrirForm && (
          <Cartao titulo={editando ? `NF ${editando.numero_nf} · ${nomeSecretaria.get(editando.secretaria_id) ?? ""}` : "Lançar NF de combustível"}>
            <FormularioNota
              key={editando?.id ?? "nova"}
              nota={editando}
              secretarias={secretarias}
              postos={postos}
              quinzenas={quinzenas}
              dataHoje={hoje}
              voltarPara={voltar}
            />
          </Cartao>
        )}
      </div>
    </>
  );
}
