"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileDiff } from "lucide-react";

import { BOTAO, CAMPO, Erro, Secao } from "@/components/emendas/config/editores";
import { aplicarAjustes, previaAjustes, type PreviaAjustes, type RelatorioAjustes } from "@/lib/emendas/actions-config";
import { brl } from "@/lib/emendas/regras";

/**
 * Ajustes depois da análise de exequibilidade: envia a planilha atualizada, a plataforma mostra SÓ o que mudou em relação ao cadastro
 * e o gestor marca o que aplicar. Mudanças viram remanejamentos (ato e motivo ficam no histórico da emenda), emendas novas entram e as
 * que sumiram da planilha podem ser canceladas. Nada é gravado antes de "Aplicar".
 */
export function ImportadorAjustes({ anos }: { anos: number[] }) {
  const router = useRouter();
  const [ano, setAno] = React.useState(String(anos[0] ?? new Date().getFullYear()));
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [previa, setPrevia] = React.useState<Extract<PreviaAjustes, { sucesso: true }> | null>(null);
  const [alteradas, setAlteradas] = React.useState<Set<number>>(new Set());
  const [novas, setNovas] = React.useState<Set<number>>(new Set());
  const [canceladas, setCanceladas] = React.useState<Set<number>>(new Set());
  const [ato, setAto] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState<"previa" | "aplicando" | null>(null);
  const [relatorio, setRelatorio] = React.useState<RelatorioAjustes[] | null>(null);

  function form() {
    const fd = new FormData();
    if (arquivo) fd.set("arquivo", arquivo);
    fd.set("ano", ano);
    return fd;
  }

  async function comparar() {
    setErro(null);
    setPrevia(null);
    setRelatorio(null);
    setOcupado("previa");
    const r = await previaAjustes(form());
    setOcupado(null);
    if (!r.sucesso) return setErro(r.erro);
    setPrevia(r);
    setAlteradas(new Set(r.comparacao.alteradas.map((a) => a.numero)));
    setNovas(new Set(r.comparacao.novas));
    setCanceladas(new Set());
  }

  async function aplicar() {
    setErro(null);
    setOcupado("aplicando");
    const fd = form();
    fd.set("ato", ato);
    fd.set("motivo", motivo);
    fd.set("alteradas", JSON.stringify([...alteradas]));
    fd.set("novas", JSON.stringify([...novas]));
    fd.set("canceladas", JSON.stringify([...canceladas]));
    const r = await aplicarAjustes(fd);
    setOcupado(null);
    if (!r.sucesso) return setErro(r.erro);
    setRelatorio(r.itens);
    setPrevia(null);
    router.refresh();
  }

  const alternar = (conj: Set<number>, set: (s: Set<number>) => void, n: number) => {
    const novo = new Set(conj);
    if (novo.has(n)) novo.delete(n);
    else novo.add(n);
    set(novo);
  };
  const c = previa?.comparacao;
  const total = alteradas.size + novas.size + canceladas.size;

  return (
    <div id="ajustes">
      <Secao
        titulo="Ajustes depois da exequibilidade (planilha atualizada)"
        apoio="Envie a planilha atualizada do ano. A plataforma compara com o que já está cadastrado e mostra só o que mudou; você marca o que aplicar. Cada mudança vira remanejamento, com o ato e o motivo."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            Exercício
            <select className={CAMPO} value={ano} onChange={(e) => setAno(e.target.value)}>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-700">
            Planilha (.xlsx)
            <input type="file" accept=".xlsx" className="text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className={BOTAO} onClick={() => void comparar()} disabled={!arquivo || ocupado !== null}>
            <FileDiff className="h-4 w-4" aria-hidden /> {ocupado === "previa" ? "Comparando…" : "Comparar com o cadastro"}
          </button>
        </div>
        <Erro texto={erro} />

        {previa && c && (
          <div className="mt-4 flex flex-col gap-4">
            {previa.erros.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-red-700" role="alert">
                {previa.erros.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <p className="text-sm text-slate-700">
              {c.alteradas.length} alterada(s) · {c.novas.length} nova(s) · {c.ausentes.length} ausente(s) na planilha · {c.iguais} sem mudança.
            </p>

            {c.alteradas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[640px] border-collapse text-[13px]">
                  <caption className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700">Emendas alteradas</caption>
                  <tbody>
                    {c.alteradas.map((a) => (
                      <tr key={a.numero} className="border-t border-slate-100 align-top">
                        <td className="w-10 px-3 py-2">
                          <input type="checkbox" aria-label={`Aplicar ajustes da emenda ${a.numero}`} checked={alteradas.has(a.numero)} onChange={() => alternar(alteradas, setAlteradas, a.numero)} />
                        </td>
                        <th scope="row" className="px-2 py-2 text-left font-medium text-cataguases-marinho">Nº {a.numero}</th>
                        <td className="px-2 py-2">
                          <ul className="flex flex-col gap-1">
                            {a.mudancas.map((m) => (
                              <li key={m.campo} className="text-xs">
                                <span className="font-medium text-slate-700">{m.rotulo}:</span> <span className="text-slate-500 line-through">{m.antes || "—"}</span> → <span className="text-slate-900">{m.depois}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {c.novas.length > 0 && (
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-700">Emendas novas (não existem no cadastro)</legend>
                <div className="flex flex-wrap gap-3">
                  {c.novas.map((n) => (
                    <label key={n} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={novas.has(n)} onChange={() => alternar(novas, setNovas, n)} /> Nº {n}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {c.ausentes.length > 0 && (
              <fieldset className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <legend className="px-1 text-xs font-semibold text-amber-900">Estão no cadastro, mas sumiram da planilha (marque para cancelar)</legend>
                <div className="flex flex-col gap-1">
                  {c.ausentes.map((a) => (
                    <label key={a.numero} className="flex items-start gap-1.5 text-xs">
                      <input type="checkbox" className="mt-0.5" checked={canceladas.has(a.numero)} onChange={() => alternar(canceladas, setCanceladas, a.numero)} />
                      <span>
                        Nº {a.numero} · {brl(a.valor)} · {a.objeto}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {total > 0 && (
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                  Ato (obrigatório)
                  <input className={CAMPO} value={ato} maxLength={200} onChange={(e) => setAto(e.target.value)} placeholder="ex.: Ofício da Câmara 045/2026" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                  Motivo (obrigatório)
                  <input className={CAMPO} value={motivo} maxLength={2000} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: ajustes após a análise de exequibilidade" />
                </label>
                <button type="button" className={BOTAO} disabled={ocupado !== null || ato.trim().length < 3 || motivo.trim().length < 5} onClick={() => void aplicar()}>
                  {ocupado === "aplicando" ? "Aplicando…" : `Aplicar ${total} ajuste(s)`}
                </button>
              </div>
            )}
          </div>
        )}

        {relatorio && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3" role="status">
            <p className="text-sm font-medium text-cataguases-marinho">
              {relatorio.filter((i) => i.ok).length} de {relatorio.length} ajuste(s) aplicados.
            </p>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {relatorio.map((i) => (
                <li key={`${i.acao}-${i.numero}`} className={i.ok ? "text-green-800" : "text-red-700"}>
                  Nº {i.numero} · {i.acao}: {i.ok ? "ok" : "falhou"}
                  {i.detalhe ? ` (${i.detalhe})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Secao>
    </div>
  );
}
