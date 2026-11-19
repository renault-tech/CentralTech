import type { CSSProperties } from "react";

import type { InfoModulo } from "@/lib/modulos-info";

/**
 * Tema do módulo em que a pessoa está: variáveis CSS (`--modulo`, `--modulo-texto`, `--modulo-tinta`) que os
 * componentes compartilhados (botões, navegação, exportar…) leem. Cada layout de módulo põe isto
 * no elemento raiz; fora de módulo valem os padrões da Central em `globals.css`.
 */
export function estiloModulo(m: Pick<InfoModulo, "cor" | "corTexto" | "corTextoEscuro">): CSSProperties {
  return {
    "--modulo": m.cor,
    // Fundo de botão (com texto branco) e, no claro, também texto/ícone.
    "--modulo-texto": m.corTexto,
    // Texto/ícone/anel na cor do módulo: no tema escuro `globals.css` troca pela versão clara.
    "--modulo-tinta": m.corTexto,
    "--modulo-tinta-escuro": m.corTextoEscuro,
  } as CSSProperties;
}

/**
 * Largura útil e margens do conteúdo dos módulos internos (Emendas, Frotas, Imóveis) e da faixa de abas deles: uma só
 * definição, para a faixa e a página ficarem alinhadas. 90rem (1440 px em tamanho normal) aproveita monitores largos sem
 * esticar leitura corrida, porque as telas dos módulos são tabelas e painéis.
 */
export const LARGURA_MODULO = "max-w-[90rem]";
export const MARGENS_MODULO = "px-4 py-5 sm:px-6 sm:py-6";
