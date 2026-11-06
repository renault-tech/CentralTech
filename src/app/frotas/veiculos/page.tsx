import Link from "next/link";

import { FormularioFiltros } from "@/components/modulo/formulario-filtros";

import { AtualizarFipe } from "@/components/frotas/acoes-veiculos";
import { FormularioVeiculo } from "@/components/frotas/formulario-veiculo";
import { Cartao, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, SeloSituacaoVeiculo, Selo, TituloPagina, Vazio } from "@/components/frotas/ui";
import { filtrarVeiculos, lerFiltroVeiculos } from "@/lib/frotas/filtros";
import { listarFornecedores, listarSecretarias, listarVeiculos, obterContextoFrotas } from "@/lib/frotas/dados";
import { brl } from "@/lib/frotas/regras";
import { resumirRevisao, revisarVeiculos } from "@/lib/frotas/revisao";
import { montarUrl } from "@/lib/frotas/url";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { MenuExportarFrotas } from "@/components/frotas/menu-exportar-frotas";
import { opcoesExportar } from "@/lib/frotas/exportacao";

export const metadata = { title: "Veículos · Frotas" };

const LIMITE_LINHAS = 300;
const COMBUSTIVEL = { gasolina: "Gasolina", flex: "Flex", diesel: "Diesel", diesel_s10: "Diesel S10" } as const;
const VINCULO = { proprio: "Próprio", convenio: "Convênio", alugado: "Alugado" } as const;

export default async function PaginaVeiculos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [veiculos, secretarias, locadoras] = await Promise.all([listarVeiculos(), listarSecretarias(), listarFornecedores("locadora")]);

  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const avisos = revisarVeiculos(veiculos);
  const resumo = resumirRevisao(veiculos, avisos);
  const filtro = lerFiltroVeiculos(sp);
  const lista = filtrarVeiculos(veiculos, filtro, new Set(avisos.keys()));
  const visiveis = lista.slice(0, LIMITE_LINHAS);

  const editarId = typeof sp.editar === "string" ? sp.editar : undefined;
  const editando = editarId ? (veiculos.find((v) => v.id === editarId) ?? null) : null;
  const abrirForm = gestor && (sp.novo === "1" || !!editando);

  const base = { q: filtro.q, sec: filtro.secretaria, sit: filtro.situacao, vinc: filtro.vinculo, rev: filtro.revisar ? "1" : undefined };
  const voltar = montarUrl("/frotas/veiculos", base);
  const contagem = { proprio: 0, convenio: 0, alugado: 0 };
  for (const v of veiculos) contagem[v.vinculo] += 1;

  return (
    <>
      <TituloPagina
        titulo="Veículos"
        subtitulo={`${veiculos.length} veículos: ${contagem.proprio} próprios, ${contagem.convenio} de convênio e ${contagem.alugado} alugados. O valor de referência vem da tabela FIPE.`}
        acao={
          <>
            <MenuExportarFrotas opcoes={opcoesExportar([{ r: "veiculos", rotulo: "Veículos da lista", formatos: ["xlsx", "pdf", "csv"] }], base)} />
            {gestor && (
              <>
                <Link href="/frotas/veiculos/importar" className={CLASSE_BOTAO_SECUNDARIO}>
                  Importar planilha
                </Link>
                <Link href={montarUrl("/frotas/veiculos", { ...base, novo: "1" })} className={CLASSE_BOTAO}>
                  Novo veículo
                </Link>
              </>
            )}
          </>
        }
      />

      {gestor && (
        <div className="mb-4 flex justify-end">
          <AtualizarFipe />
        </div>
      )}

      {resumo.length > 0 && (
        <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-[15px] font-semibold text-amber-900">Dados a revisar antes de confiar nos relatórios</h2>
          <p className="mt-1 text-sm text-amber-900">
            A importação não corrige nada sozinha: marca cada ponto e o veículo continua cadastrado. Quando o dado for corrigido (ou marcado como correto), o aviso some.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {resumo.map((g) => (
              <span key={g.codigo} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[13px] font-semibold text-amber-900">
                <strong className="font-bold">{g.n}</strong> {g.rotulo}
              </span>
            ))}
            <Link href={montarUrl("/frotas/veiculos", { rev: "1" })} className="rounded-full bg-amber-900 px-3 py-1 text-[13px] font-semibold text-white hover:bg-amber-950">
              Ver só os veículos com aviso
            </Link>
          </div>
        </section>
      )}

      <div className={abrirForm ? "grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(360px,1.2fr)]" : ""}>
        <Cartao semPadding>
          <FormularioFiltros className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5" limpar={{ href: "/frotas/veiculos", className: CLASSE_BOTAO_SECUNDARIO }}>
            <div className="flex min-w-[220px] flex-[2] flex-col gap-1">
              <label htmlFor="f-q" className="text-xs font-semibold text-slate-600">Buscar</label>
              <input id="f-q" name="q" defaultValue={filtro.q} placeholder="Placa, modelo, marca ou patrimônio" className={ESTILO_CAMPO_PADRAO} />
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
            <div className="flex min-w-[130px] flex-1 flex-col gap-1">
              <label htmlFor="f-vinc" className="text-xs font-semibold text-slate-600">Vínculo</label>
              <select id="f-vinc" name="vinc" defaultValue={filtro.vinculo ?? ""} className={ESTILO_CAMPO_PADRAO}>
                <option value="">Todos</option>
                <option value="proprio">Próprios</option>
                <option value="convenio">Convênio</option>
                <option value="alugado">Alugados</option>
              </select>
            </div>
            <div className="flex min-w-[130px] flex-1 flex-col gap-1">
              <label htmlFor="f-sit" className="text-xs font-semibold text-slate-600">Situação</label>
              <select id="f-sit" name="sit" defaultValue={filtro.situacao ?? ""} className={ESTILO_CAMPO_PADRAO}>
                <option value="">Todas</option>
                <option value="ativo">Ativo</option>
                <option value="em_manutencao">Em manutenção</option>
                <option value="inativo">Inativo</option>
                <option value="baixado">Baixado</option>
              </select>
            </div>
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="rev" value="1" defaultChecked={filtro.revisar} />
              Só com aviso
            </label>
          </FormularioFiltros>

          {visiveis.length === 0 ? (
            <Vazio>{veiculos.length === 0 ? "Nenhum veículo cadastrado ainda." : "Nenhum veículo encontrado com esses filtros."}</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    {["Placa", "Veículo", "Secretaria", "Combustível", "Situação", "Valor de referência", "Revisar"].map((t) => (
                      <th key={t} scope="col" className="px-4 py-2.5 first:sm:pl-5">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((v) => {
                    const a = avisos.get(v.id) ?? [];
                    return (
                      <tr key={v.id} className={`border-t border-slate-100 align-top hover:bg-slate-50 ${editando?.id === v.id ? "bg-[#F7FAF0]" : a.length ? "bg-amber-50/40" : ""}`}>
                        <td className="px-4 py-2.5 font-semibold sm:pl-5">
                          <Link href={montarUrl("/frotas/veiculos", { ...base, editar: v.id })} className="text-cataguases-marinho hover:underline">
                            {v.placa ?? "Sem placa"}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium">{v.modelo}</span>
                          <span className="block text-xs text-slate-500">
                            {[v.marca, v.ano_fabricacao && v.ano_modelo && v.ano_fabricacao !== v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : (v.ano_modelo ?? v.ano_fabricacao), v.patrimonio ? `patr. ${v.patrimonio}` : null].filter(Boolean).join(" · ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block">{nomeSecretaria.get(v.secretaria_id) ?? "—"}{v.setor ? ` · ${v.setor}` : ""}</span>
                          <span className="block text-xs text-slate-500">{VINCULO[v.vinculo]}</span>
                        </td>
                        <td className="px-4 py-2.5">{v.combustivel ? COMBUSTIVEL[v.combustivel] : "—"}</td>
                        <td className="px-4 py-2.5">
                          <SeloSituacaoVeiculo situacao={v.situacao} />
                          {v.motivo_situacao && <span className="mt-1 block max-w-[220px] text-xs text-slate-500">{v.motivo_situacao}</span>}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {v.vinculo === "alugado" ? (
                            <span className="text-xs text-slate-500">Não se aplica</span>
                          ) : v.valor_referencia !== null ? (
                            <>
                              {brl(v.valor_referencia)}
                              <span className="block text-xs text-slate-500">{v.valor_fonte === "fipe" ? "FIPE" : "Informado"}</span>
                            </>
                          ) : (
                            <Selo tom="ambar">Falta o valor</Selo>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] font-semibold text-amber-900">
                          {a.map((x) => (
                            <span key={x.codigo} className="block">{x.texto}</span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            {lista.length > LIMITE_LINHAS ? `Mostrando ${LIMITE_LINHAS} de ${lista.length}. Use os filtros para achar o resto.` : `${lista.length} de ${veiculos.length} veículos.`}
          </p>
        </Cartao>

        {abrirForm && (
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
        )}
      </div>
    </>
  );
}
