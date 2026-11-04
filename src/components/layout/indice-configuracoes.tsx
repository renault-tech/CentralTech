import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type CartaoConfiguracao = {
  href: string;
  titulo: string;
  descricao: string;
  Icone: LucideIcon;
  cor: string;
  /** Selo vermelho com a contagem de pendências (só aparece se > 0). */
  contagem?: number;
};

/**
 * Índice de Configurações: um card por área — o MESMO em todos os módulos (Central, Emendas,
 * Frotas; Compras e Requerimentos têm cópia idêntica). A faixa de abas (`AbasNavegacao`) do layout
 * da área continua disponível para trocar de área sem voltar ao índice.
 */
export function IndiceConfiguracoes({ cartoes, colunas = 3 }: { cartoes: CartaoConfiguracao[]; colunas?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${colunas === 3 ? "lg:grid-cols-3" : ""}`}>
      {cartoes.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group relative rounded-[20px] border border-[rgba(12,29,51,0.07)] bg-white/75 p-[18px] shadow-[0_2px_10px_rgba(12,29,51,0.04)] backdrop-blur-[10px] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cataguases-azul focus-visible:ring-offset-2"
        >
          {!!card.contagem && (
            <span className="absolute right-4 top-4 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cataguases-vermelho px-1.5 text-[11px] font-semibold text-white">
              {card.contagem}
            </span>
          )}
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px]" style={{ backgroundColor: `${card.cor}1F`, color: card.cor }}>
            <card.Icone className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-cataguases-marinho">{card.titulo}</p>
          <p className="mt-1 text-[13px] leading-[1.4] text-slate-500">{card.descricao}</p>
        </Link>
      ))}
    </div>
  );
}
