"use client";

import * as React from "react";
import Link from "next/link";

import { importarVeiculos, previaImportacao, type PreviaImportacao, type ResultadoImportacao } from "@/lib/frotas/actions-importacao";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem, Selo } from "@/components/frotas/ui";

const ROTULO_VINCULO = { proprio: "Próprio", convenio: "Convênio", alugado: "Alugado" } as const;

/** Importa a planilha de veículos: primeiro mostra o que vai acontecer, só depois grava. Reimportar não duplica. */
export function ImportadorVeiculos() {
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [previa, setPrevia] = React.useState<PreviaImportacao | null>(null);
  const [resultado, setResultado] = React.useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function dados(): FormData {
    const fd = new FormData();
    if (arquivo) fd.set("arquivo", arquivo);
    return fd;
  }

  function analisar() {
    setErro(null);
    setPrevia(null);
    setResultado(null);
    iniciar(async () => {
      const r = await previaImportacao(dados());
      if (!r.sucesso) return setErro(r.erro);
      setPrevia(r.previa);
    });
  }

  function importar() {
    setErro(null);
    iniciar(async () => {
      const r = await importarVeiculos(dados());
      if (!r.sucesso) return setErro(r.erro);
      setPrevia(null);
      setResultado(r.resultado);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Planilha de veículos (.xlsx)"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setPrevia(null);
            setResultado(null);
            setErro(null);
          }}
          className="text-sm"
        />
        <button type="button" disabled={!arquivo || pendente} onClick={analisar} className={CLASSE_BOTAO_SECUNDARIO}>
          {pendente && !previa ? "Analisando…" : "Analisar a planilha"}
        </button>
      </div>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}

      {previa && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-800">
            Foram lidos <strong>{previa.lidos}</strong> veículos ({previa.abas.filter((a) => a.vinculo).map((a) => `${a.lidos} em “${a.nome}”`).join(", ")}).{" "}
            <strong>{previa.novos}</strong> são novos e <strong>{previa.jaExistem}</strong> já estão cadastrados (não serão repetidos nem alterados).
          </p>
          {previa.secretariasNovas.length > 0 && <Mensagem tipo="aviso">Secretarias que serão criadas: {previa.secretariasNovas.join(", ")}.</Mensagem>}
          {previa.locadorasNovas.length > 0 && <Mensagem tipo="aviso">Locadoras que serão cadastradas: {previa.locadorasNovas.join(", ")}.</Mensagem>}
          {previa.avisos.map((a) => (
            <Mensagem key={a} tipo="aviso">{a}</Mensagem>
          ))}
          {previa.amostra.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="pb-1.5 text-left text-xs font-semibold text-slate-600">Primeiros veículos novos</caption>
                <tbody>
                  {previa.amostra.map((v, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="py-1.5 pr-3 font-medium">{v.placa ?? "Sem placa"}</td>
                      <td className="py-1.5 pr-3">{v.modelo}</td>
                      <td className="py-1.5 pr-3">{v.secretaria}</td>
                      <td className="py-1.5"><Selo>{ROTULO_VINCULO[v.vinculo as keyof typeof ROTULO_VINCULO] ?? v.vinculo}</Selo></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-600">
            A importação não corrige nada sozinha: placas e patrimônios repetidos entram como estão e ficam marcados em “Dados a revisar”.
          </p>
          <div>
            <button type="button" disabled={pendente || previa.novos === 0} onClick={importar} className={CLASSE_BOTAO}>
              {pendente ? "Importando…" : `Importar ${previa.novos} veículos`}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <Mensagem tipo={resultado.criados > 0 ? "ok" : "aviso"}>
          {resultado.criados} veículos importados, {resultado.jaExistiam} já existiam
          {resultado.ignorados > 0 ? `, ${resultado.ignorados} ficaram de fora por falta de locadora` : ""}.{" "}
          <Link href="/frotas/veiculos" className="font-semibold underline">Ver os veículos</Link>
        </Mensagem>
      )}
    </div>
  );
}
