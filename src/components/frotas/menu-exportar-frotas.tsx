"use client";

import * as React from "react";
import { X } from "lucide-react";

import { MenuExportar, type OpcaoExportar } from "@/components/modulo/menu-exportar";
import { COLUNAS_RELATORIO, SEPARADOR_COLUNAS, assinarOcultas, guardarOcultas, lerOcultas, lerOcultasBruto } from "@/lib/frotas/colunas";
import { ROTULO_RELATORIO, type IdRelatorio } from "@/lib/frotas/relatorios";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";

type Ocultas = Partial<Record<IdRelatorio, string[]>>;

/**
 * "Exportar" do Frotas: o menu de sempre, mais "Escolher colunas…". O padrão é tudo; o que a pessoa
 * esconde fica guardado neste navegador (por relatório) e vai na URL de cada exportação.
 */
export function MenuExportarFrotas({ opcoes, compacto }: { opcoes: OpcaoExportar[]; compacto?: boolean }) {
  const bruto = React.useSyncExternalStore(assinarOcultas, lerOcultasBruto, () => "{}");
  const ocultas: Ocultas = React.useMemo(() => lerOcultas(bruto), [bruto]);
  const [aberto, setAberto] = React.useState(false);

  const relatorios = [...new Set(opcoes.map((o) => o.relatorio).filter((r): r is IdRelatorio => !!r && r in COLUNAS_RELATORIO))];

  const comColunas = opcoes.map((o) => {
    const escondidas = o.relatorio ? ocultas[o.relatorio as IdRelatorio] : undefined;
    if (!o.href || !escondidas?.length) return o;
    return { ...o, href: `${o.href}${o.href.includes("?") ? "&" : "?"}sem=${encodeURIComponent(escondidas.join(SEPARADOR_COLUNAS))}` };
  });
  const todas: OpcaoExportar[] =
    relatorios.length > 0
      ? [...comColunas, { rotulo: "Escolher colunas…", detalhe: "Define o que aparece nos arquivos", aoClicar: () => setAberto(true) }]
      : comColunas;

  function alterar(r: IdRelatorio, proximas: string[]) {
    const novo = { ...ocultas, [r]: proximas };
    if (proximas.length === 0) delete novo[r];
    guardarOcultas(novo);
  }

  return (
    <>
      <MenuExportar opcoes={todas} compacto={compacto} />
      {aberto && <EscolherColunas relatorios={relatorios} ocultas={ocultas} alterar={alterar} fechar={() => setAberto(false)} />}
    </>
  );
}

function EscolherColunas({
  relatorios,
  ocultas,
  alterar,
  fechar,
}: {
  relatorios: IdRelatorio[];
  ocultas: Ocultas;
  alterar: (r: IdRelatorio, proximas: string[]) => void;
  fechar: () => void;
}) {
  const fecharRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    fecharRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [fechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4 print:hidden" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div role="dialog" aria-modal="true" aria-label="Escolher colunas da exportação" className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-cataguases-marinho">Colunas da exportação</h2>
            <p className="mt-0.5 text-xs text-slate-600">Desmarque o que não quer nos arquivos. Sua escolha fica guardada neste navegador.</p>
          </div>
          <button ref={fecharRef} type="button" onClick={fechar} aria-label="Fechar" className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {relatorios.map((r) => {
            const colunas = COLUNAS_RELATORIO[r];
            const escondidas = ocultas[r] ?? [];
            return (
              <fieldset key={r} className="min-w-0">
                <legend className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold text-cataguases-marinho">
                  <span>{ROTULO_RELATORIO[r]}</span>
                  {escondidas.length > 0 && (
                    <button type="button" onClick={() => alterar(r, [])} className="text-xs font-medium text-[color:var(--modulo-texto)] underline underline-offset-2">
                      Mostrar todas
                    </button>
                  )}
                </legend>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {colunas.map((c) => {
                    const visivel = !escondidas.includes(c);
                    const visiveis = colunas.length - escondidas.length;
                    return (
                      <label key={c} className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                        <input
                          type="checkbox"
                          checked={visivel}
                          disabled={visivel && visiveis <= 1}
                          onChange={() => alterar(r, visivel ? [...escondidas, c] : escondidas.filter((x) => x !== c))}
                          className="size-4 shrink-0 accent-[color:var(--modulo-texto)]"
                        />
                        <span className="min-w-0 break-words">{c}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={() => guardarOcultas({})} className={CLASSE_BOTAO_SECUNDARIO}>
            Mostrar tudo
          </button>
          <button type="button" onClick={fechar} className={CLASSE_BOTAO}>
            Pronto
          </button>
        </footer>
      </div>
    </div>
  );
}
