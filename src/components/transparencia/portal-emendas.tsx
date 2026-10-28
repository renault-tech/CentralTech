"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import type { LinhaPortal } from "@/lib/emendas/portal";
import { brl, brlCurto, dataBr, pct } from "@/lib/emendas/regras";

const CAMPO = "h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const POR_PAGINA = 30;

/** Portal público: lista filtrável, sem login. Filtra no navegador sobre o que já chegou. */
export function PortalEmendas({ linhas, etapas, ano, anos }: { linhas: LinhaPortal[]; etapas: Record<string, string>; ano: number; anos: number[] }) {
  const router = useRouter();
  const [busca, setBusca] = React.useState("");
  const [vereador, setVereador] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [secretaria, setSecretaria] = React.useState("");
  const [limite, setLimite] = React.useState(POR_PAGINA);

  const vereadores = Array.from(new Set(linhas.map((l) => l.vereador))).sort();
  const secretarias = Array.from(new Set(linhas.map((l) => l.secretaria))).sort();
  const q = norm(busca.trim());
  const filtradas = linhas.filter(
    (l) =>
      (!vereador || l.vereador === vereador) &&
      (!tipo || l.tipo === tipo) &&
      (!secretaria || l.secretaria === secretaria) &&
      (!q || q.split(/\s+/).every((t) => norm([l.numero, l.objeto, l.beneficiario ?? "", l.vereador, l.secretaria].join(" ")).includes(t)))
  );
  const total = filtradas.reduce((s, l) => s + l.valor, 0);
  const empenhado = filtradas.reduce((s, l) => s + l.empenhado, 0);
  const pago = filtradas.reduce((s, l) => s + l.pago, 0);
  const reinicia = (f: () => void) => () => {
    f();
    setLimite(POR_PAGINA);
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-t-[3px] border-[#6B4FBB] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prefeitura de Cataguases · Transparência</p>
          <h1 className="mt-1 text-2xl font-semibold">Emendas impositivas {ano}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Recursos indicados pelos vereadores no orçamento do município, com a situação de cada um: quem indicou, para quê, para quem, quanto já foi empenhado e pago.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Emendas", String(filtradas.length)],
            ["Valor indicado", brlCurto(total)],
            ["Empenhado", `${brlCurto(empenhado)} · ${pct(empenhado / (total || 1))}`],
            ["Pago", `${brlCurto(pago)} · ${pct(pago / (total || 1))}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
            Buscar
            <input type="search" className={CAMPO} placeholder="Objeto, beneficiário, vereador ou nº" value={busca} onChange={(e) => reinicia(() => setBusca(e.target.value))()} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Exercício
            <select className={CAMPO} value={ano} onChange={(e) => router.push(`/transparencia/emendas?ano=${e.target.value}`)}>
              {anos.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Vereador
            <select className={CAMPO} value={vereador} onChange={(e) => reinicia(() => setVereador(e.target.value))()}>
              <option value="">Todos</option>
              {vereadores.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Tipo
            <select className={CAMPO} value={tipo} onChange={(e) => reinicia(() => setTipo(e.target.value))()}>
              <option value="">Todos</option>
              {ORDEM_TIPOS.map((t) => <option key={t} value={t}>{TIPOS_EXECUCAO[t].nome}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Secretaria
            <select className={CAMPO} value={secretaria} onChange={(e) => reinicia(() => setSecretaria(e.target.value))()}>
              <option value="">Todas</option>
              {secretarias.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <ul className="flex flex-col gap-2">
          {filtradas.slice(0, limite).map((l) => (
            <li key={l.numero} className="rounded-xl border border-slate-200 bg-white" style={{ borderLeft: `8px solid ${TIPOS_EXECUCAO[l.tipo].cor}`, backgroundColor: `${TIPOS_EXECUCAO[l.tipo].cor}0D` }}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-3.5">
                  <span className="font-mono text-xs text-slate-500">nº {l.numero}</span>
                  <span className="min-w-0 flex-1 font-medium">{l.objeto}</span>
                  <span className="text-sm font-semibold tabular-nums">{brl(l.valor)}</span>
                  <span className="w-full text-xs text-slate-600">
                    {l.vereador} · {l.secretaria} · {TIPOS_EXECUCAO[l.tipo].curto} · {etapas[l.etapa] ?? l.etapa}
                    {l.situacao === "impedida" && " · Impedida"}
                  </span>
                </summary>
                <dl className="grid gap-x-6 gap-y-2 border-t border-slate-100 p-3.5 text-[13px] sm:grid-cols-2">
                  {[
                    ["Beneficiário", l.beneficiario ? `${l.beneficiario}${l.cnpj ? ` · CNPJ ${l.cnpj}` : ""}` : null],
                    ["Unidade orçamentária", l.unidade],
                    ["Funcional programática", l.funcional],
                    ["Natureza da despesa", l.natureza],
                    ["Saúde", l.saude ? "Sim" : "Não"],
                    ["Empenhado", brl(l.empenhado)],
                    ["Liquidado", brl(l.liquidado)],
                    ["Pago", `${brl(l.pago)}${l.ultimoPagamento ? ` (último em ${dataBr(l.ultimoPagamento)})` : ""}`],
                    ["Termo de parceria", l.termo],
                    ["Vigência", l.vigenciaFim ? `${l.vigenciaInicio ? dataBr(l.vigenciaInicio) : "—"} a ${dataBr(l.vigenciaFim)}` : null],
                    ["Extrato publicado em", l.extratoPublicadoEm ? dataBr(l.extratoPublicadoEm) : null],
                    ["Conta da parceria", l.contaMascarada],
                    ["Impedimento", l.impedimento],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-xs text-slate-500">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            </li>
          ))}
          {filtradas.length === 0 && <li className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Nenhuma emenda encontrada.</li>}
        </ul>
        {filtradas.length > limite && (
          <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="mx-auto h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm hover:bg-slate-50">
            Mostrar mais
          </button>
        )}

        <footer className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
          <p>
            Dados abertos:{" "}
            <a className="font-medium text-[#5B3FA8] underline" href={`/transparencia/emendas/dados?ano=${ano}&formato=csv`}>CSV</a>{" · "}
            <a className="font-medium text-[#5B3FA8] underline" href={`/transparencia/emendas/dados?ano=${ano}&formato=json`}>JSON</a>
          </p>
          <p>
            Publicação em cumprimento à Lei de Acesso à Informação (Lei 12.527/2011), à Lei de Responsabilidade Fiscal (art. 48-A) e à IN TCE-MG nº 05/2025.
            Dados atualizados a cada poucos minutos a partir do sistema de gestão. Contas bancárias aparecem mascaradas e não são publicados dados pessoais (Lei 13.709/2018, LGPD).
          </p>
          <p>
            Limite de emendas individuais e destinação mínima à saúde: Constituição Federal, art. 166, §§ 9º a 11, aplicados por simetria, e Lei Orgânica do Município.
            Repasses a entidades: Lei 13.019/2014. Despesa pública: Lei 4.320/1964. Contratações: Lei 14.133/2021.
          </p>
        </footer>
      </main>
    </div>
  );
}
