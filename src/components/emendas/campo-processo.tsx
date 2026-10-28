"use client";

import * as React from "react";

import { sugerirProcessosCompras } from "@/lib/emendas/actions";
import type { SugestaoProcesso } from "@/lib/emendas/compras";

const NOME_STATUS: Record<string, string> = { em_andamento: "Em andamento", concluido: "Concluído", suspenso: "Suspenso", cancelado: "Cancelado" };

/**
 * Caixa de busca de processo do Compras: sem digitar, sugere pelos termos do objeto da emenda;
 * digitando, filtra por parte do número (62, 2026/00, 136/) ou por palavras do objeto.
 * Escolher uma sugestão devolve o número (o processo, ou a licitação se já tiver).
 */
export function CampoProcesso({
  emendaId,
  valor,
  aoMudar,
  aoEscolher,
  desabilitado,
}: {
  emendaId: string;
  valor: string;
  aoMudar: (v: string) => void;
  aoEscolher: (s: SugestaoProcesso) => void;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [itens, setItens] = React.useState<SugestaoProcesso[]>([]);
  const [carregando, setCarregando] = React.useState(false);
  const [ativo, setAtivo] = React.useState(-1);
  const rotuloId = React.useId();
  const versao = React.useRef(0);

  React.useEffect(() => {
    if (!aberto) return;
    const minha = ++versao.current;
    const t = setTimeout(async () => {
      setCarregando(true);
      const r = await sugerirProcessosCompras(emendaId, valor).catch(() => []);
      if (minha !== versao.current) return; // resposta velha
      setItens(r);
      setAtivo(-1);
      setCarregando(false);
    }, valor ? 250 : 0);
    return () => clearTimeout(t);
  }, [aberto, valor, emendaId]);

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && ativo >= 0 && itens[ativo]) {
      e.preventDefault();
      escolher(itens[ativo]);
    } else if (e.key === "Escape") setAberto(false);
  }
  function escolher(s: SugestaoProcesso) {
    setAberto(false);
    aoEscolher(s);
  }

  return (
    <div className="relative min-w-0 flex-1" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setAberto(false)}>
      <input
        value={valor}
        disabled={desabilitado}
        onChange={(e) => {
          aoMudar(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclas}
        placeholder="Número ou palavra do objeto"
        aria-label="Buscar processo no Compras por número ou objeto"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={rotuloId}
        aria-autocomplete="list"
        autoComplete="off"
        className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]"
      />
      {aberto && (
        <ul id={rotuloId} role="listbox" className="absolute right-0 top-full z-20 mt-1 max-h-96 w-[30rem] max-w-[calc(100vw-2rem)] overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-slate-400" aria-hidden>
            {valor.trim() ? "Resultados" : "Sugeridos pelo objeto da emenda"}
          </li>
          {itens.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === ativo}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(s)}
                className={`flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50 ${i === ativo ? "bg-slate-100" : ""}`}
              >
                <span className="text-[13px] font-medium text-cataguases-marinho">
                  {s.numero}
                  {s.numero_licitacao ? ` · licitação ${s.numero_licitacao}` : ""}
                </span>
                <span className="ml-2 text-[11px] text-slate-500">{NOME_STATUS[s.status] ?? s.status}</span>
                <span className="mt-0.5 line-clamp-3 text-xs leading-snug text-slate-600">{s.objeto}</span>
              </button>
            </li>
          ))}
          {!itens.length && (
            <li className="px-3 py-2 text-xs text-slate-500">{carregando ? "Buscando…" : valor.trim() ? "Nada encontrado. Tente outro trecho do número ou do objeto." : "Sem sugestões. Digite o número ou uma palavra do objeto."}</li>
          )}
        </ul>
      )}
    </div>
  );
}
