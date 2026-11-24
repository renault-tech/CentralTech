"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CircleHelp, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Confirmações e avisos da plataforma: um cartão no centro da tela, com fundo escurecido, no lugar das caixas feias do navegador
 * (`window.confirm`, `prompt`, `alert`). Uma única implementação para todos os módulos, montada uma vez no layout raiz.
 *
 *   const { confirmar, pedirTexto, avisar } = useDialogos();
 *   if (!(await confirmar({ titulo: "Excluir a NF?", mensagem: "…", rotuloConfirmar: "Excluir", tom: "perigo" }))) return;
 *   const motivo = await pedirTexto({ titulo: "Excluir lançamento", rotulo: "Justificativa", minimo: 10, tom: "perigo" }); // null = cancelou
 *   await avisar({ titulo: "Não foi possível", mensagem: "…", tom: "erro" });
 *
 * Esc e o clique no fundo cancelam. Em ações perigosas o foco começa em "Cancelar". O cartão herda a cor do módulo de onde foi aberto.
 */

export type TomDialogo = "padrao" | "perigo" | "info" | "erro";

type Base = {
  titulo: string;
  mensagem?: React.ReactNode;
  tom?: TomDialogo;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
};
export type OpcoesConfirmar = Base;
export type OpcoesTexto = Base & {
  /** Rótulo do campo (acima dele). */
  rotulo?: string;
  placeholder?: string;
  /** Mínimo de caracteres (sem contar espaços nas pontas). */
  minimo?: number;
  /** Se informado, o texto digitado precisa ser exatamente este (ex.: o número da emenda). */
  igualA?: string;
  multilinha?: boolean;
  valorInicial?: string;
};
export type OpcoesAviso = Omit<Base, "rotuloCancelar">;

type Pedido =
  | { tipo: "confirmar"; opcoes: OpcoesConfirmar; resolver: (v: boolean) => void }
  | { tipo: "texto"; opcoes: OpcoesTexto; resolver: (v: string | null) => void }
  | { tipo: "aviso"; opcoes: OpcoesAviso; resolver: () => void };

type Api = {
  confirmar: (o: OpcoesConfirmar) => Promise<boolean>;
  pedirTexto: (o: OpcoesTexto) => Promise<string | null>;
  avisar: (o: OpcoesAviso) => Promise<void>;
};

const Contexto = React.createContext<Api | null>(null);

export function useDialogos(): Api {
  const api = React.useContext(Contexto);
  if (!api) throw new Error("useDialogos precisa do ProvedorDialogos (montado no layout raiz).");
  return api;
}

export function ProvedorDialogos({ children }: { children: React.ReactNode }) {
  const [fila, setFila] = React.useState<Pedido[]>([]);

  const api = React.useMemo<Api>(() => {
    const enfileirar = (p: Pedido) => setFila((f) => [...f, p]);
    return {
      confirmar: (opcoes) => new Promise<boolean>((resolver) => enfileirar({ tipo: "confirmar", opcoes, resolver })),
      pedirTexto: (opcoes) => new Promise<string | null>((resolver) => enfileirar({ tipo: "texto", opcoes, resolver })),
      avisar: (opcoes) => new Promise<void>((resolver) => enfileirar({ tipo: "aviso", opcoes, resolver })),
    };
  }, []);

  const atual = fila[0];
  const fechar = () => setFila((f) => f.slice(1));

  return (
    <Contexto.Provider value={api}>
      {children}
      {atual && <Cartao key={fila.length + atual.opcoes.titulo} pedido={atual} aoFechar={fechar} />}
    </Contexto.Provider>
  );
}

const ICONES = { padrao: CircleHelp, perigo: AlertTriangle, info: Info, erro: XCircle } as const;
const DISCO: Record<TomDialogo, string> = {
  padrao: "bg-[color-mix(in_srgb,var(--modulo)_14%,transparent)] text-[color:var(--modulo-tinta)]",
  perigo: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  erro: "bg-red-100 text-red-700",
};
const BASE_BOTAO = "inline-flex min-h-11 py-1 min-w-[6.5rem] items-center justify-center rounded-[0.625rem] px-4 text-sm font-semibold transition-[filter,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10";
const BOTAO_SECUNDARIO = `${BASE_BOTAO} border border-slate-300 bg-white text-cataguases-marinho hover:bg-slate-50`;

function Cartao({ pedido, aoFechar }: { pedido: Pedido; aoFechar: () => void }) {
  const o = pedido.opcoes;
  const tom: TomDialogo = o.tom ?? (pedido.tipo === "aviso" ? "info" : "padrao");
  const Icone = ICONES[tom];
  const idTitulo = React.useId();
  const idTexto = React.useId();
  const cartaoRef = React.useRef<HTMLDivElement>(null);
  const campoRef = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cancelarRef = React.useRef<HTMLButtonElement>(null);
  const confirmarRef = React.useRef<HTMLButtonElement>(null);
  const [texto, setTexto] = React.useState(pedido.tipo === "texto" ? (pedido.opcoes.valorInicial ?? "") : "");
  const [tentou, setTentou] = React.useState(false);

  // Cor do módulo de onde o cartão foi aberto (o portal fica fora do contêiner que define as variáveis).
  const [cores] = React.useState(() => {
    const origem = (typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : document.body) as HTMLElement;
    const css = getComputedStyle(origem);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const estilo: Record<string, string> = {};
    for (const n of ["--modulo", "--modulo-texto", "--modulo-tinta"]) if (v(n)) estilo[n] = v(n);
    return estilo;
  });
  const [anterior] = React.useState<Element | null>(() => (typeof document !== "undefined" ? document.activeElement : null));

  const texto_ = texto.trim();
  const erroCampo =
    pedido.tipo !== "texto"
      ? null
      : pedido.opcoes.igualA !== undefined
        ? texto_ === pedido.opcoes.igualA
          ? null
          : "O texto digitado não confere."
        : pedido.opcoes.minimo && texto_.length < pedido.opcoes.minimo
          ? `Escreva pelo menos ${pedido.opcoes.minimo} caracteres (${texto_.length} até agora).`
          : null;

  const cancelar = React.useCallback(() => {
    if (pedido.tipo === "confirmar") pedido.resolver(false);
    else if (pedido.tipo === "texto") pedido.resolver(null);
    else pedido.resolver();
    aoFechar();
  }, [pedido, aoFechar]);

  const confirmar = () => {
    if (pedido.tipo === "texto") {
      if (erroCampo) {
        setTentou(true);
        campoRef.current?.focus();
        return;
      }
      pedido.resolver(texto_);
    } else if (pedido.tipo === "confirmar") pedido.resolver(true);
    else pedido.resolver();
    aoFechar();
  };

  // Foco inicial, trava a rolagem do fundo, Esc cancela, Tab fica dentro do cartão e o foco volta ao botão de origem.
  React.useEffect(() => {
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alvo = campoRef.current ?? (tom === "perigo" && pedido.tipo !== "aviso" ? cancelarRef.current : confirmarRef.current);
    alvo?.focus();
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancelar();
      } else if (ev.key === "Tab" && cartaoRef.current) {
        const focaveis = Array.from(cartaoRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea")).filter((el) => el.offsetParent !== null);
        if (focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (ev.shiftKey && document.activeElement === primeiro) {
          ev.preventDefault();
          ultimo.focus();
        } else if (!ev.shiftKey && document.activeElement === ultimo) {
          ev.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = rolagem;
      if (anterior instanceof HTMLElement) anterior.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotuloConfirmar = o.rotuloConfirmar ?? (pedido.tipo === "aviso" ? "Entendi" : tom === "perigo" ? "Confirmar" : "Confirmar");
  const botaoConfirmar = tom === "perigo" || tom === "erro" ? `${BASE_BOTAO} bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600` : `${BASE_BOTAO} bg-[color:var(--modulo-texto)] text-white hover:brightness-110 focus-visible:outline-[color:var(--modulo)]`;
  const Campo = pedido.tipo === "texto" && pedido.opcoes.multilinha ? "textarea" : "input";

  return createPortal(
    <div className="dialogo-fundo fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-[2px]" onMouseDown={(ev) => ev.target === ev.currentTarget && cancelar()} style={cores}>
      <div
        ref={cartaoRef}
        role={pedido.tipo === "aviso" ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={o.mensagem ? idTexto : undefined}
        className="dialogo-cartao w-full max-w-[26rem] rounded-[0.9375rem] border border-slate-200 p-5 text-left shadow-[0_24px_60px_-20px_rgb(15_23_42/0.55)] sm:p-6"
        style={{ backgroundColor: "rgb(var(--surface))" }}
      >
        <div className="flex items-start gap-3.5">
          <span aria-hidden className={cn("grid h-11 w-11 flex-none place-items-center rounded-full", DISCO[tom])}>
            <Icone className="h-6 w-6" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={idTitulo} className="text-[1.0625rem] font-semibold leading-snug tracking-tight text-cataguases-marinho text-balance">
              {o.titulo}
            </h2>
            {o.mensagem && (
              <div id={idTexto} className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {o.mensagem}
              </div>
            )}
          </div>
        </div>

        {pedido.tipo === "texto" && (
          <div className="mt-4">
            {pedido.opcoes.rotulo && (
              <label htmlFor={`${idTitulo}-campo`} className="mb-1 block text-[0.8125rem] font-medium text-cataguases-marinho">
                {pedido.opcoes.rotulo}
              </label>
            )}
            <Campo
              id={`${idTitulo}-campo`}
              ref={campoRef}
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && (!pedido.opcoes.multilinha || ev.ctrlKey || ev.metaKey)) {
                  ev.preventDefault();
                  confirmar();
                }
              }}
              placeholder={pedido.opcoes.placeholder}
              rows={pedido.opcoes.multilinha ? 3 : undefined}
              aria-invalid={tentou && !!erroCampo}
              aria-describedby={erroCampo ? `${idTitulo}-erro` : undefined}
              className="w-full rounded-[0.625rem] border border-slate-300 bg-white px-3 py-2 text-sm text-cataguases-marinho outline-none focus:border-[color:var(--modulo)] focus:ring-2 focus:ring-[color:var(--modulo)]/25"
            />
            <p id={`${idTitulo}-erro`} className={cn("mt-1 min-h-[1.125rem] text-xs", tentou && erroCampo ? "text-red-700" : "text-slate-500")}>
              {erroCampo && (tentou || pedido.opcoes.minimo) ? erroCampo : ""}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {pedido.tipo !== "aviso" && (
            <button ref={cancelarRef} type="button" onClick={cancelar} className={`${BOTAO_SECUNDARIO} focus-visible:outline-[color:var(--modulo)]`}>
              {(o as Base).rotuloCancelar ?? "Cancelar"}
            </button>
          )}
          <button ref={confirmarRef} type="button" onClick={confirmar} className={botaoConfirmar}>
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
