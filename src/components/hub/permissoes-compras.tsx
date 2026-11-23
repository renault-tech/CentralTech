"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { definirPermissoesCompras } from "@/lib/actions/configuracoes";
import { alternarPermissao, GRUPOS_COMPRAS, MODELOS_COMPRAS, normalizarPermissoes, permissaoEfetiva } from "@/lib/permissoes/catalogo";

/**
 * Permissões do Compras de UMA pessoa. O cabeçalho (quem + de qual módulo + salvar) fica fixo enquanto se rola a lista,
 * para nunca perder de vista a que pessoa e a que módulo cada interruptor se refere. Modelos ligam um conjunto de uma vez;
 * depois dá para ajustar item a item. Nada é gravado até clicar em "Salvar".
 */
export function PermissoesCompras({ usuarioId, nome, perfil, inicial, retiradas }: { usuarioId: string; nome: string; perfil: string; inicial: string[]; retiradas: string[] }) {
  const base = React.useMemo(() => {
    const l = new Set(inicial);
    const r = new Set(retiradas);
    const efetivas = new Set(GRUPOS_COMPRAS.flatMap((g) => g.itens).filter((i) => permissaoEfetiva(i, perfil, l, r)).map((i) => i.chave));
    return normalizarPermissoes(efetivas);
  }, [inicial, retiradas, perfil]);
  const [ligadas, setLigadas] = React.useState<Set<string>>(base);
  const [pendente, setPendente] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);

  const alteradas = [...new Set([...ligadas, ...base])].filter((c) => ligadas.has(c) !== base.has(c)).length;

  async function salvar() {
    setPendente(true);
    setMsg(null);
    const definidas: Record<string, boolean> = {};
    for (const c of new Set([...ligadas, ...base])) if (ligadas.has(c) !== base.has(c)) definidas[c] = ligadas.has(c);
    const r = await definirPermissoesCompras({ usuarioId, definidas });
    setPendente(false);
    setMsg(r.sucesso ? { ok: true, texto: "Permissões salvas. Valem na próxima tela que a pessoa abrir." } : { ok: false, texto: r.erro });
  }

  return (
    <section className="mt-3 rounded-md border border-slate-200 bg-white" aria-label={`Permissões de ${nome} no Compras`}>
      <header className="sticky top-[3.5rem] z-[5] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-t-md border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{nome}</p>
          <p className="text-xs text-slate-600">
            Permissões no <strong>Compras</strong> · perfil <span className="font-mono">{perfil}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Aplicar um modelo de permissões"
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
            value=""
            onChange={(e) => {
              const m = MODELOS_COMPRAS.find((x) => x.id === e.target.value);
              if (m) setLigadas(normalizarPermissoes(new Set(m.chaves)));
            }}
          >
            <option value="">Aplicar modelo…</option>
            {MODELOS_COMPRAS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={pendente || alteradas === 0} onClick={salvar}>
            {pendente ? "Salvando…" : alteradas > 0 ? `Salvar (${alteradas})` : "Salvar"}
          </Button>
        </div>
      </header>

      <div className="divide-y divide-slate-100">
        {GRUPOS_COMPRAS.map((g) => (
          <fieldset key={g.id} className="px-3 py-2">
            <legend className="px-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">{g.titulo}</legend>
            <ul className="mt-1 space-y-1">
              {g.itens.map((i) => {
                const travada = !!i.exige && !ligadas.has(i.exige);
                return (
                  <li key={i.chave}>
                    <label className={`flex items-start gap-2 text-sm ${travada ? "text-slate-400" : "text-slate-700"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={ligadas.has(i.chave)}
                        disabled={travada}
                        onChange={(e) => setLigadas((atual) => alternarPermissao(atual, i.chave, e.target.checked))}
                      />
                      <span>
                        {i.rotulo}
                        {i.padraoPerfis?.includes(perfil) && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[0.6875rem] text-slate-600">já vem do perfil</span>}
                        {travada && <Lock className="ml-1 inline h-3 w-3" aria-hidden />}
                        <span className="block text-xs text-slate-500">{i.ajuda}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>

      {msg && <p className={`border-t border-slate-100 px-3 py-2 text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.texto}</p>}
    </section>
  );
}
