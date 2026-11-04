import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Peças visuais COMPARTILHADAS entre os módulos (Emendas, Frotas e os próximos): botões, cartão,
 * selos, título de página, campo e mensagem. Leem a cor do módulo das variáveis `--modulo` e
 * `--modulo-texto` (ver `estiloModulo`), então o mesmo botão sai roxo no Emendas e verde no Frotas.
 * Sem estado: servem a Server e a Client Components.
 */

const BOTAO_BASE =
  "btn-ui inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-200 " +
  "h-11 px-4 sm:h-9 sm:px-3.5 disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--modulo-tinta)] focus-visible:ring-offset-2";

/** Ação principal da tela: na cor do módulo. */
export const CLASSE_BOTAO = `${BOTAO_BASE} bg-[color:var(--modulo-texto)] text-white hover:brightness-125`;
export const CLASSE_BOTAO_SECUNDARIO = `${BOTAO_BASE} border border-slate-300 bg-white text-cataguases-marinho hover:bg-slate-50`;
export const CLASSE_BOTAO_PERIGO = `${BOTAO_BASE} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
/** Botão de uma linha de tabela ou barra de filtros (mesma forma, sem o alvo de 44 px). */
export const CLASSE_BOTAO_COMPACTO =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-cataguases-marinho transition-colors duration-200 hover:bg-slate-50 disabled:opacity-50";

export function Cartao({
  titulo,
  apoio,
  acao,
  children,
  className,
  semPadding,
}: {
  titulo?: string;
  apoio?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Para tabelas que vão de borda a borda. */
  semPadding?: boolean;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>
      {(titulo || apoio || acao) && (
        <div className={cn("flex flex-wrap items-baseline justify-between gap-2 p-4 sm:px-5", semPadding ? "pb-3" : "pb-0")}>
          {titulo && <h2 className="text-[15px] font-semibold text-cataguases-marinho">{titulo}</h2>}
          {apoio && <span className="text-xs text-slate-500">{apoio}</span>}
          {acao}
        </div>
      )}
      <div className={semPadding ? "" : "p-4 pt-3 sm:p-5 sm:pt-3"}>{children}</div>
    </section>
  );
}

export type NivelAlerta = "ok" | "atencao" | "critico";

const textoDias = (dias: number) => (dias === 1 ? "1 dia" : `${dias} dias`);

const ESTILO_NIVEL: Record<NivelAlerta, { fundo: string; texto: string; ponto: string }> = {
  ok: { fundo: "bg-slate-100", texto: "text-slate-700", ponto: "bg-slate-400" },
  atencao: { fundo: "bg-amber-100", texto: "text-amber-900", ponto: "bg-amber-600" },
  critico: { fundo: "bg-red-100", texto: "text-red-800", ponto: "bg-red-600" },
};

/** Selo com o nível do alerta. A cor nunca é o único sinal: o texto diz "atenção"/"crítico". */
export function SeloNivel({ nivel, children, comPonto = true }: { nivel: NivelAlerta; children: ReactNode; comPonto?: boolean }) {
  const e = ESTILO_NIVEL[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", e.fundo, e.texto)}>
      {comPonto && <span aria-hidden className={cn("h-2 w-2 rounded-full", e.ponto)} />}
      {children}
    </span>
  );
}

const SUFIXO_NIVEL: Record<NivelAlerta, string> = { ok: "", atencao: " · atenção", critico: " · crítico" };

export function SeloDias({ dias, nivel }: { dias: number; nivel: NivelAlerta }) {
  return <SeloNivel nivel={nivel}>{`${textoDias(dias)}${SUFIXO_NIVEL[nivel]}`}</SeloNivel>;
}

export function Selo({ children, tom = "neutro" }: { children: ReactNode; tom?: "neutro" | "azul" | "verde" | "ambar" | "vermelho" }) {
  const estilos = {
    neutro: "bg-slate-100 text-slate-700",
    azul: "bg-sky-100 text-sky-900",
    verde: "bg-green-100 text-green-900",
    ambar: "bg-amber-100 text-amber-900",
    vermelho: "bg-red-100 text-red-800",
  } as const;
  return <span className={cn("inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight", estilos[tom])}>{children}</span>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-1 py-6 text-center text-sm text-slate-500">{children}</p>;
}

/** Título de página: o MESMO em todos os módulos (tamanho, peso e espaçamento). */
export function TituloPagina({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-cataguases-marinho">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitulo}</p>}
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2">{acao}</div>}
    </div>
  );
}

export function Campo({ rotulo, htmlFor, children, dica, className }: { rotulo: string; htmlFor: string; children: ReactNode; dica?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-slate-700">
        {rotulo}
      </label>
      {children}
      {dica && <span className="text-xs text-slate-500">{dica}</span>}
    </div>
  );
}

/** Mensagem de formulário: erro, aviso (não bloqueia) ou confirmação. */
export function Mensagem({ tipo, children }: { tipo: "erro" | "aviso" | "ok"; children: ReactNode }) {
  const estilos = {
    erro: "border-red-200 bg-red-50 text-red-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
    ok: "border-green-200 bg-green-50 text-green-900",
  } as const;
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", estilos[tipo])}>
      {children}
    </p>
  );
}
