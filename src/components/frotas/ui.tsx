import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { COR_TEXTO_MODULO, textoDias, type NivelAlerta } from "@/lib/frotas/regras";
import type { SituacaoVeiculo } from "@/types/frotas";

/** Peças visuais do módulo Frotas, sem estado (servem a Server e Client Components). */

export const CLASSE_BOTAO =
  "inline-flex h-9 items-center justify-center rounded-lg bg-[#3F5A12] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#33480F] disabled:opacity-50";
export const CLASSE_BOTAO_SECUNDARIO =
  "inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-cataguases-marinho transition-colors hover:bg-slate-50 disabled:opacity-50";
export const CLASSE_BOTAO_PERIGO =
  "inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50";

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
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", estilos[tom])}>{children}</span>;
}

export const ROTULO_SITUACAO_VEICULO: Record<SituacaoVeiculo, string> = {
  ativo: "Ativo",
  em_manutencao: "Em manutenção",
  inativo: "Inativo",
  baixado: "Baixado",
};

export function SeloSituacaoVeiculo({ situacao }: { situacao: SituacaoVeiculo }) {
  const tom = situacao === "ativo" ? "verde" : situacao === "em_manutencao" ? "ambar" : "neutro";
  return <Selo tom={tom}>{ROTULO_SITUACAO_VEICULO[situacao]}</Selo>;
}

/** Cartão-número do painel; leva à lista filtrada. */
export function CartaoNumero({ rotulo, valor, nota, href, destaque }: { rotulo: string; valor: number; nota: string; href: string; destaque?: boolean }) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#5C7A1F] hover:bg-[#F7FAF0]"
    >
      <span className="text-xs font-medium text-slate-600">{rotulo}</span>
      <span className={cn("text-3xl font-bold tabular-nums tracking-tight", destaque ? "text-red-700" : "text-cataguases-marinho")}>{valor}</span>
      <span className="text-xs text-slate-500">{nota}</span>
    </Link>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="px-1 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Barra({ valor, nivel = "ok", marcaEm }: { valor: number; nivel?: NivelAlerta; marcaEm?: number }) {
  const cor = nivel === "critico" ? "#B42318" : nivel === "atencao" ? "#B7791F" : "#5C7A1F";
  return (
    <span className="relative block h-2 w-full rounded-full bg-slate-200" aria-hidden>
      <span className="block h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, valor))}%`, backgroundColor: cor }} />
      {marcaEm !== undefined && <span className="absolute -top-[3px] h-3.5 w-0.5 bg-amber-600" style={{ left: `${marcaEm}%` }} />}
    </span>
  );
}

export function TituloPagina({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-cataguases-marinho">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitulo}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
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

export const COR_LINK_MODULO = COR_TEXTO_MODULO;

/** Aviso (não bloqueia) ou erro de formulário. */
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
