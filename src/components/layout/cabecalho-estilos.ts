/**
 * Estilos dos controles do cabeçalho escuro da Central — ÚNICA definição, usada por todos os
 * botões e links do cabeçalho (sino, feedback, ajuda, Configurações, Sair…). Antes cada um tinha o
 * seu tamanho e forma (a Ajuda era até um quadrado branco no marinho). Alvo de toque de 44 px no
 * celular, 40 px no computador; foco dourado visível (`.cabecalho-escuro` em globals.css).
 */
const BASE =
  "relative inline-flex items-center justify-center rounded-lg text-slate-200 transition-colors duration-200 hover:bg-white/10 hover:text-white";

/** Botão só com ícone (sino, megafone, ajuda). Sempre com `aria-label`. */
export const CLASSE_ICONE_CABECALHO = `${BASE} h-11 w-11 sm:h-10 sm:w-10`;

/** Link ou botão com texto (Novidades, Configurações, Feedback, Sair). */
export const CLASSE_LINK_CABECALHO = `${BASE} h-11 gap-1.5 px-3 text-sm sm:h-10`;

/** Contador vermelho (pedidos pendentes, feedback novo). */
export const CLASSE_CONTADOR_CABECALHO =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cataguases-vermelho px-1.5 text-[11px] font-semibold text-white";
