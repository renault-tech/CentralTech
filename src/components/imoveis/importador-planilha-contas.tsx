"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, Cartao, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem, Selo } from "@/components/imoveis/ui";
import { importarPlanilhaContas, previaPlanilhaContas, type ResultadoImportacao, type ResultadoPrevia } from "@/lib/imoveis/actions-importacao-contas";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

type Previa = Extract<ResultadoPrevia, { sucesso: true }>;
type Linha = { incluir: boolean; imovelId: string };

/** Importa a planilha de controle de água ou luz (uma aba por secretaria): lê, mostra o que aconteceria e só grava depois de confirmar. */
export function ImportadorPlanilhaContas() {
  const router = useRouter();
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [vinculo, setVinculo] = React.useState("proprio");
  const [previa, setPrevia] = React.useState<Previa | null>(null);
  const [abas, setAbas] = React.useState<Record<string, string>>({});
  const [linhas, setLinhas] = React.useState<Record<string, Linha>>({});
  const [resultado, setResultado] = React.useState<Extract<ResultadoImportacao, { sucesso: true }> | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function ler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    const form = new FormData(e.currentTarget);
    const f = form.get("arquivo");
    if (f instanceof File) setArquivo(f);
    iniciar(async () => {
      const r = await previaPlanilhaContas(form);
      if (!r.sucesso) return setErro(r.erro);
      setPrevia(r);
      setAbas(Object.fromEntries(r.abas.map((a) => [a.nome, a.secretariaSugerida ?? ""])));
      setLinhas(Object.fromEntries(r.abas.flatMap((a) => a.linhas.map((l) => [l.chave, { incluir: l.situacao !== "ignorada", imovelId: l.imovelSugeridoId ?? "" }]))));
    });
  }

  const totais = React.useMemo(() => {
    if (!previa) return null;
    let linhasN = 0;
    let novas = 0;
    let contas = 0;
    for (const a of previa.abas) {
      if (!abas[a.nome]) continue;
      for (const l of a.linhas) {
        if (!linhas[l.chave]?.incluir || l.ignorada) continue;
        linhasN++;
        if (l.situacao === "nova") {
          novas++;
          contas += l.mesesComValor;
        } else contas += l.mesesNovos;
      }
    }
    return { linhasN, novas, contas };
  }, [previa, abas, linhas]);

  function importar() {
    if (!previa || !arquivo) return;
    setErro(null);
    const form = new FormData();
    form.set("arquivo", arquivo);
    form.set(
      "decisoes",
      JSON.stringify({
        tipo: previa.tipo,
        ano: previa.ano,
        vinculo,
        abas,
        linhas: Object.fromEntries(Object.entries(linhas).map(([k, v]) => [k, { incluir: v.incluir, imovelId: v.imovelId || null }])),
      })
    );
    iniciar(async () => {
      const r = await importarPlanilhaContas(form);
      if (!r.sucesso) return setErro(r.erro);
      setResultado(r);
      setPrevia(null);
      router.refresh();
    });
  }

  const campo = ESTILO_CAMPO_PADRAO;
  const nomeSecretaria = (id: string) => previa?.secretarias.find((s) => s.id === id)?.nome ?? "";
  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="1. Escolha a planilha" apoio="uma planilha por vez: de água (COPASA) ou de luz (Energisa)">
        <form onSubmit={ler} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Planilha (.xlsx)" htmlFor="pl-arq" className="sm:col-span-2"><input id="pl-arq" name="arquivo" type="file" accept=".xlsx" required className="text-sm" /></Campo>
          <Campo rotulo="É a planilha de" htmlFor="pl-tipo">
            <select id="pl-tipo" name="tipo" className={campo} defaultValue="luz"><option value="luz">Luz (Energisa)</option><option value="agua">Água (COPASA)</option></select>
          </Campo>
          <Campo rotulo="Ano dos meses (Jan a Dez)" htmlFor="pl-ano"><input id="pl-ano" name="ano" type="number" min={2000} max={2100} defaultValue={new Date().getFullYear()} required className={campo} /></Campo>
          <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente && !previa ? "Lendo…" : "Ler planilha"}</button></div>
        </form>
        <p className="mt-3 text-xs text-slate-500">Os números de cada mês são lidos como <b>valor da conta em reais</b>. Nada é gravado antes da sua confirmação, e importar de novo a mesma planilha não duplica nem sobrescreve meses já lançados.</p>
      </Cartao>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {resultado && (
        <Mensagem tipo={resultado.avisos.length ? "aviso" : "ok"}>
          Importação concluída: {resultado.contasGravadas} conta(s) gravada(s) em {resultado.linhas} unidade(s)
          {resultado.imoveisCriados ? `, ${resultado.imoveisCriados} imóvel(is) novo(s)` : ""}
          {resultado.unidadesCriadas ? `, ${resultado.unidadesCriadas} unidade(s) nova(s)` : ""}
          {resultado.secretariasCriadas ? `, ${resultado.secretariasCriadas} secretaria(s) criada(s)` : ""}
          {resultado.contasJaLancadas ? `. ${resultado.contasJaLancadas} conta(s) já estavam lançadas e foram mantidas` : ""}.
          {resultado.avisos.length > 0 && <> Avisos: {resultado.avisos.join(" ")}</>}
        </Mensagem>
      )}

      {previa && totais && (
        <>
          {previa.avisos.map((a) => <Mensagem key={a} tipo="aviso">{a}</Mensagem>)}
          <Cartao titulo="2. Confira antes de importar" apoio={`${previa.tipo === "luz" ? "Luz" : "Água"} · ${previa.ano}`}>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Vínculo dos imóveis NOVOS" htmlFor="pl-vinc" dica="As planilhas trazem todos os pontos de consumo; ajuste depois, imóvel a imóvel.">
                <select id="pl-vinc" className={campo} value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
                  <option value="proprio">Próprio</option><option value="alugado">Alugado</option><option value="cedido">Cedido</option>
                </select>
              </Campo>
            </div>
            <ul className="flex flex-col gap-3">
              {previa.abas.map((a) => {
                const secId = abas[a.nome] ?? "";
                const candidatos = secId && secId !== "novo" ? previa.imoveis.filter((i) => i.secretaria_id === secId) : [];
                const naoImporta = secId === "";
                return (
                  <li key={a.nome} className="rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-end gap-3 p-3 sm:px-4">
                      <div className="min-w-[140px]"><p className="text-sm font-semibold text-cataguases-marinho">{a.nome}</p><p className="text-xs text-slate-500">{a.linhas.length} unidade(s)</p></div>
                      <Campo rotulo="Secretaria" htmlFor={`sec-${a.nome}`} className="min-w-[220px] flex-1">
                        <select id={`sec-${a.nome}`} className={campo} value={secId} onChange={(e) => setAbas((x) => ({ ...x, [a.nome]: e.target.value }))}>
                          <option value="">Não importar esta aba</option>
                          <option value="novo">Criar secretaria “{a.nome}”</option>
                          {previa.secretarias.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                      </Campo>
                      {a.secretariaSugerida === null && secId === "" && <Selo tom="ambar">Escolha a secretaria</Selo>}
                    </div>
                    <details open={a.linhas.length <= 8 && !naoImporta} className="border-t border-slate-100">
                      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[color:var(--modulo-tinta)] sm:px-4">Ver as unidades desta aba</summary>
                      <div className="overflow-x-auto">
                        <table className={`w-full min-w-[820px] text-left text-sm ${naoImporta ? "opacity-50" : ""}`}>
                          <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Importar</th><th className="px-3 py-2">Setor e endereço</th><th className="px-3 py-2">Código</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Meses</th><th className="px-3 py-2">Imóvel</th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {a.linhas.map((l) => {
                              const dec = linhas[l.chave] ?? { incluir: false, imovelId: "" };
                              return (
                                <tr key={l.chave}>
                                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Importar ${l.setor}`} disabled={!!l.ignorada || naoImporta} checked={dec.incluir && !naoImporta} onChange={(e) => setLinhas((x) => ({ ...x, [l.chave]: { ...dec, incluir: e.target.checked } }))} /></td>
                                  <td className="px-3 py-2"><span className="font-medium">{l.setor}</span><span className="block text-xs text-slate-500">{l.endereco || "sem endereço"}</span></td>
                                  <td className="px-3 py-2 font-mono text-xs">{l.codigo}</td>
                                  <td className="px-3 py-2">{l.ignorada ? <span title={l.ignorada}><Selo tom="vermelho">Não é conta</Selo></span> : l.situacao === "unidade_existente" ? <Selo tom="azul">Já cadastrada</Selo> : <Selo tom="verde">Nova</Selo>}</td>
                                  <td className="px-3 py-2 tabular-nums text-xs">{l.ignorada ? "—" : l.situacao === "unidade_existente" ? `${l.mesesNovos} novo(s)${l.mesesJaLancados ? ` · ${l.mesesJaLancados} já lançado(s)` : ""}` : `${l.mesesComValor}`}</td>
                                  <td className="px-3 py-2">
                                    {l.situacao === "nova" && !l.ignorada ? (
                                      <select aria-label={`Imóvel de ${l.setor}`} className={`${campo} min-w-[180px]`} value={dec.imovelId} onChange={(e) => setLinhas((x) => ({ ...x, [l.chave]: { ...dec, imovelId: e.target.value } }))} disabled={naoImporta}>
                                        <option value="">Criar imóvel novo</option>
                                        {candidatos.map((i) => <option key={i.id} value={i.id}>Ligar a: {i.nome}</option>)}
                                      </select>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {secId && secId !== "novo" && <p className="px-3 pb-2 text-xs text-slate-500 sm:px-4">Secretaria: {nomeSecretaria(secId)}</p>}
                    </details>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-700"><b>{totais.linhasN}</b> unidade(s) ({totais.novas} nova(s)), cerca de <b>{totais.contas}</b> conta(s) a gravar.</p>
              <button type="button" disabled={pendente || totais.linhasN === 0} className={CLASSE_BOTAO} onClick={importar}>{pendente ? "Importando…" : "Importar agora"}</button>
              <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={() => setPrevia(null)}>Descartar</button>
            </div>
          </Cartao>
        </>
      )}
    </div>
  );
}
