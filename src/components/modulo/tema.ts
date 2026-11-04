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
