import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho navy-gradiente com o brasão em medalhão d'água — mesmo padrão
 * usado no painel inicial (`HeroSaudacao`, que agora é uma composição
 * deste componente), levado às demais páginas para a identidade visual
 * não ficar restrita à primeira tela. Regra da casa: nunca duplicar
 * classificação/regra de dados — aqui o equivalente é não duplicar o
 * "molde" visual (gradiente, recorte do selo, régua dourada).
 */
export function CabecalhoPagina({
  titulo,
  subtitulo,
  acao,
  tamanho = "padrao",
}: {
  titulo: string;
  subtitulo?: string;
  /** Botão(ões)/filtro(s) do lado direito, na mesma linha do título. */
  acao?: ReactNode;
  /** "grande" é só do painel inicial — medalhão maior, mais respiro. */
  tamanho?: "padrao" | "grande";
}) {
  const grande = tamanho === "grande";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#0C1D33,#132C4C_55%,#0E2440)] shadow-[0_10px_30px_rgba(9,17,31,0.18)]",
        grande ? "px-5 py-5 sm:px-7 sm:py-6" : "px-5 py-4 sm:px-6 sm:py-5"
      )}
    >
      {/* logo.png tem o texto "Cataguases Prefeitura" no terço inferior —
          origin-top + scale ancoram o zoom no topo da imagem, e o
          overflow-hidden do wrapper corta a faixa de texto por baixo. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 overflow-hidden rounded-full opacity-10",
          grande ? "h-36 w-36 sm:-right-6 sm:-top-6 sm:h-48 sm:w-48" : "h-28 w-28 sm:h-36 sm:w-36"
        )}
      >
        <Image
          src="/logo.png"
          alt=""
          fill
          sizes={grande ? "192px" : "144px"}
          className="origin-top scale-150 object-cover object-top"
        />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span
            aria-hidden
            className={cn(
              "mb-2 block rounded-full bg-cataguases-dourado",
              grande ? "h-[3px] w-9" : "h-[3px] w-7"
            )}
          />
          <h1 className={cn("font-semibold text-white", grande ? "text-2xl" : "text-xl sm:text-2xl")}>
            {titulo}
          </h1>
          {subtitulo && (
            <p className={cn("mt-0.5 text-[rgba(180,199,224,0.85)]", grande ? "text-sm" : "text-[13px]")}>
              {subtitulo}
            </p>
          )}
        </div>
        {acao && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acao}</div>}
      </div>
    </div>
  );
}
