"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Cartao, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem, Selo } from "@/components/imoveis/ui";
import { confirmarContasPdf, lerContasPdf, type LinhaPrevia, type OpcaoUnidadePdf, type ResultadoLinha } from "@/lib/imoveis/actions-contas-pdf";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

type Editavel = { arquivo: string; semTexto: boolean; avisos: string[]; unidadeId: string; mes: string; consumo: string; valor: string; vencimento: string; incluir: boolean };

/** Prévia de faturas em PDF: o servidor propõe, a pessoa confere e confirma. */
export function ImportadorContasPdf() {
  const router = useRouter();
  const [linhas, setLinhas] = React.useState<Editavel[]>([]);
  const [unidades, setUnidades] = React.useState<OpcaoUnidadePdf[]>([]);
  const [resultados, setResultados] = React.useState<ResultadoLinha[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function ler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setResultados(null);
    const form = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await lerContasPdf(form);
      if (!r.sucesso) return setErro(r.erro);
      setUnidades(r.unidades);
      setLinhas(
        r.linhas.map((l: LinhaPrevia) => ({
          arquivo: l.arquivo,
          semTexto: l.semTexto,
          avisos: l.avisos,
          unidadeId: l.unidadeId ?? "",
          mes: l.referencia ? l.referencia.slice(0, 7) : "",
          consumo: l.consumo !== null ? String(l.consumo) : "",
          valor: valorParaCampo(l.valor),
          vencimento: l.vencimento ?? "",
          incluir: l.encontrados >= 3 && !l.semTexto,
        }))
      );
    });
  }

  const mudar = (i: number, parte: Partial<Editavel>) => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...parte } : l)));

  function confirmar() {
    setErro(null);
    const escolhidas = linhas.map((l, i) => ({ l, i })).filter(({ l }) => l.incluir);
    const entrada: Parameters<typeof confirmarContasPdf>[0] = [];
    for (const { l } of escolhidas) {
      const v = lerValor(l.valor);
      const c = l.consumo ? lerValor(l.consumo) : null;
      if (v === null || Number.isNaN(v) || (c !== null && Number.isNaN(c)) || !l.mes) return setErro(`Confira ${l.arquivo}: valor, consumo e mês precisam estar válidos.`);
      entrada.push({ unidadeId: l.unidadeId, referencia: `${l.mes}-01`, consumo: c, valor: v, vencimento: l.vencimento || null });
    }
    if (entrada.length === 0) return setErro("Marque ao menos uma linha para confirmar.");
    iniciar(async () => {
      const r = await confirmarContasPdf(entrada);
      if (!r.sucesso) return setErro(r.erro);
      setResultados(r.resultados);
      // As gravadas saem da lista; as que falharam ficam para corrigir.
      const falharam = new Set(escolhidas.filter((_, k) => !r.resultados[k].ok).map(({ i }) => i));
      setLinhas((ls) => ls.filter((_, i) => !escolhidas.some((e) => e.i === i) || falharam.has(i)));
      router.refresh();
    });
  }

  const campo = `${ESTILO_CAMPO_PADRAO} min-w-0`;
  return (
    <div className="flex flex-col gap-4">
      <Cartao titulo="1. Escolha os PDFs" apoio="até 20 arquivos, 5 MB cada">
        <form onSubmit={ler} className="flex flex-wrap items-center gap-3">
          <label htmlFor="pdfs" className="sr-only">PDFs das faturas</label>
          <input id="pdfs" name="arquivos" type="file" accept="application/pdf" multiple required className="text-sm" />
          <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente && linhas.length === 0 ? "Lendo…" : "Ler faturas"}</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">O sistema lê o texto, acha o imóvel pela matrícula ou UC e propõe os valores. Nada é gravado antes da sua confirmação, e o PDF não fica guardado.</p>
      </Cartao>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {resultados && (
        <Mensagem tipo={resultados.every((r) => r.ok) ? "ok" : "aviso"}>
          {resultados.filter((r) => r.ok).length} conta(s) lançada(s){resultados.some((r) => !r.ok) ? `; ${resultados.filter((r) => !r.ok).length} com problema: ${resultados.filter((r): r is { ok: false; erro: string } => !r.ok).map((r) => r.erro).join(" ")}` : "."}
        </Mensagem>
      )}

      {linhas.length > 0 && (
        <Cartao titulo="2. Confira e confirme" semPadding>
          <ul className="divide-y divide-slate-100">
            {linhas.map((l, i) => (
              <li key={`${l.arquivo}-${i}`} className="flex flex-col gap-2 p-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <input id={`inc-${i}`} type="checkbox" checked={l.incluir} onChange={(e) => mudar(i, { incluir: e.target.checked })} />
                  <label htmlFor={`inc-${i}`} className="font-mono text-xs">{l.arquivo}</label>
                  {l.semTexto && <Selo tom="vermelho">Sem texto: lance à mão</Selo>}
                </div>
                {l.avisos.map((a) => <p key={a} className="text-xs text-amber-800">⚠ {a}</p>)}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <select aria-label="Unidade" className={`${campo} lg:col-span-2`} value={l.unidadeId} onChange={(e) => mudar(i, { unidadeId: e.target.value })}>
                    <option value="">Escolha a unidade…</option>
                    {unidades.map((u) => <option key={u.id} value={u.id}>{u.rotulo}</option>)}
                  </select>
                  <input aria-label="Mês" type="month" className={campo} value={l.mes} onChange={(e) => mudar(i, { mes: e.target.value })} />
                  <input aria-label="Consumo" inputMode="decimal" placeholder="Consumo" className={campo} value={l.consumo} onChange={(e) => mudar(i, { consumo: e.target.value })} />
                  <input aria-label="Valor" inputMode="decimal" placeholder="Valor (R$)" className={campo} value={l.valor} onChange={(e) => mudar(i, { valor: e.target.value })} />
                  <input aria-label="Vencimento" type="date" className={campo} value={l.vencimento} onChange={(e) => mudar(i, { vencimento: e.target.value })} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4 sm:px-5">
            <button type="button" disabled={pendente} className={CLASSE_BOTAO} onClick={confirmar}>{pendente ? "Gravando…" : "Confirmar contas marcadas"}</button>
            <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={() => setLinhas([])}>Descartar</button>
          </div>
        </Cartao>
      )}
    </div>
  );
}
