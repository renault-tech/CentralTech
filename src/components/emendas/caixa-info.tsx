"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Quando a última caixa fechou: passar de um alvo para o vizinho logo em seguida abre mais depressa (como nos tooltips do sistema). */
let fechouEm = 0;
const ATRASO_PADRAO = 480;
const ATRASO_VIZINHO = 140;

type Props = {
  /** O que a caixa mostra (use `CaixaTitulo`, `CaixaLinhas` e `CaixaNota`). */
  conteudo: React.ReactNode;
  children: React.ReactNode;
  /** Milissegundos de mouse parado antes de abrir: evita caixas pipocando enquanto o mouse atravessa a tela. */
  atraso?: number;
  /** Largura da caixa em px (em tamanho de texto normal). */
  largura?: number;
  /** Elemento que envolve o alvo (para células de grade e itens de lista). */
  as?: "span" | "div" | "li";
  className?: string;
  style?: React.CSSProperties;
  desativada?: boolean;
};

/**
 * Caixa de informações ao passar o mouse (ou focar): o mesmo cartão claro da lista de Emendas, para dados consolidados
 * (indicadores, barras, fases, linhas de gráfico). Só abre depois de `atraso` ms com o mouse sobre o alvo e fecha ao sair, ao
 * rolar ou ao redimensionar. Vai para o `body` (portal) porque listas rolam e têm vidro, que prenderiam um elemento `fixed`;
 * por isso as cores são literais. Abre abaixo do alvo; se não couber, ao lado ou acima, sempre dentro da janela.
 */
export function CaixaInfo({ conteudo, children, atraso = ATRASO_PADRAO, largura = 288, as = "span", className, style, desativada }: Props) {
  const alvo = React.useRef<HTMLElement>(null);
  const caixa = React.useRef<HTMLDivElement>(null);
  const [aberta, setAberta] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const temporizador = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = React.useId();

  const abrir = () => {
    if (desativada) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    const espera = Date.now() - fechouEm < 300 ? Math.min(atraso, ATRASO_VIZINHO) : atraso;
    temporizador.current = setTimeout(() => setAberta(true), espera);
  };
  const fechar = React.useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setAberta((a) => {
      if (a) fechouEm = Date.now();
      return false;
    });
    setPos(null);
  }, []);
  React.useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  React.useLayoutEffect(() => {
    if (!aberta || !alvo.current || !caixa.current) return;
    const r = alvo.current.getBoundingClientRect();
    const c = caixa.current.getBoundingClientRect();
    const margem = 8;
    const cabeAbaixo = r.bottom + 8 + c.height <= window.innerHeight - margem;
    let left: number;
    let top: number;
    if (cabeAbaixo) {
      left = r.left + r.width / 2 - c.width / 2;
      top = r.bottom + 8;
    } else if (r.left - 8 - c.width >= margem) {
      left = r.left - 8 - c.width;
      top = r.top + r.height / 2 - c.height / 2;
    } else {
      left = r.left + r.width / 2 - c.width / 2;
      top = r.top - c.height - 8;
    }
    left = Math.max(margem, Math.min(left, window.innerWidth - c.width - margem));
    top = Math.max(margem, Math.min(top, window.innerHeight - c.height - margem));
    setPos({ top, left });
  }, [aberta]);

  React.useEffect(() => {
    if (!aberta) return;
    const tecla = (ev: KeyboardEvent) => ev.key === "Escape" && fechar();
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberta, fechar]);

  const Elemento = as as React.ElementType;
  return (
    <Elemento
      ref={alvo}
      className={className}
      style={style}
      onMouseEnter={abrir}
      onMouseLeave={fechar}
      onMouseDown={fechar}
      onFocus={abrir}
      onBlur={fechar}
      aria-describedby={aberta ? id : undefined}
    >
      {children}
      {aberta &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: largura, opacity: pos ? 1 : 0, zIndex: 80 }}
            className="pointer-events-none rounded-[0.875rem] border border-slate-200 bg-white p-3.5 text-cataguases-marinho shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)] transition-opacity duration-150 motion-reduce:transition-none"
          >
            {conteudo}
          </div>,
          document.body
        )}
    </Elemento>
  );
}

/** Cabeçalho da caixa: rótulo pequeno em maiúsculas, valor em destaque e, à direita, um número de apoio. */
export function CaixaTitulo({ rotulo, valor, lado, ladoApoio, corLado }: { rotulo: string; valor?: string; lado?: string; ladoApoio?: string; corLado?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{rotulo}</p>
        {valor && <p className="text-base font-semibold tabular-nums tracking-tight">{valor}</p>}
      </div>
      {(lado || ladoApoio) && (
        <div className="text-right text-xs leading-tight text-slate-600">
          {lado && <span className="block text-xl font-semibold tabular-nums" style={corLado ? { color: corLado } : undefined}>{lado}</span>}
          {ladoApoio && <span className="block tabular-nums">{ladoApoio}</span>}
        </div>
      )}
    </div>
  );
}

export type LinhaCaixa = { rotulo: string; valor: string; cor?: string; apoio?: string; forte?: boolean };

/** Linhas "rótulo ... valor" com a bolinha de cor opcional e um apoio (percentual, nota) à direita do valor. */
export function CaixaLinhas({ linhas, className }: { linhas: LinhaCaixa[]; className?: string }) {
  return (
    <dl className={cn("mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5 text-[0.8125rem]", className)}>
      {linhas.map((l) => (
        <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
          <dt className="flex min-w-0 items-center gap-1.5 text-slate-600">
            {l.cor && <span className="h-2 w-2 flex-none rounded-[2px]" style={{ backgroundColor: l.cor }} aria-hidden />}
            <span className="truncate">{l.rotulo}</span>
          </dt>
          <dd className={cn("whitespace-nowrap tabular-nums", l.forte ? "font-semibold text-cataguases-marinho" : "font-medium text-cataguases-marinho")}>
            {l.valor}
            {l.apoio && <span className="ml-1.5 text-xs font-normal text-slate-500">{l.apoio}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CaixaNota({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[0.75rem] leading-snug text-slate-600">{children}</p>;
}
