"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type BrasaoProps = {
  /** Lado do quadrado em pixels */
  tamanho?: number;
  className?: string;
};

/**
 * Logotipo oficial da Prefeitura de Cataguases.
 * Usa /logo.png (colocado em public/ pela administração). Enquanto o arquivo
 * não existir, exibe um distintivo com as cores do brasão como reserva.
 */
export function Brasao({ tamanho = 96, className }: BrasaoProps) {
  const [semLogo, setSemLogo] = React.useState(false);

  if (semLogo) {
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 96 96"
        role="img"
        aria-label="Distintivo da Prefeitura de Cataguases"
        className={cn("shrink-0", className)}
      >
        {/* Triângulo vermelho do brasão */}
        <path d="M48 8 L90 82 L6 82 Z" fill="#C63B22" />
        {/* Engrenagem dourada estilizada */}
        <circle cx="48" cy="58" r="15" fill="none" stroke="#E9A63B" strokeWidth="7" />
        <g stroke="#E9A63B" strokeWidth="6" strokeLinecap="round">
          <line x1="48" y1="36" x2="48" y2="41" />
          <line x1="48" y1="75" x2="48" y2="80" />
          <line x1="26" y1="58" x2="31" y2="58" />
          <line x1="65" y1="58" x2="70" y2="58" />
          <line x1="33" y1="43" x2="36" y2="46" />
          <line x1="60" y1="70" x2="63" y2="73" />
          <line x1="63" y1="43" x2="60" y2="46" />
          <line x1="36" y1="70" x2="33" y2="73" />
        </g>
        {/* Coroa mural dourada */}
        <path
          d="M39 22 h18 v8 h-18 z M39 22 v-5 l4 3 5-4 5 4 4-3 v5"
          fill="#E9A63B"
          stroke="#E9A63B"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Logotipo da Prefeitura de Cataguases"
      width={tamanho}
      height={tamanho}
      className={cn("shrink-0 object-contain", className)}
      onError={() => setSemLogo(true)}
    />
  );
}
