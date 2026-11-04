import type { CSSProperties } from "react";

import type { InfoModulo } from "@/lib/modulos-info";

/**
 * Tema do módulo em que a pessoa está: duas variáveis CSS (`--modulo`, `--modulo-texto`) que os
 * componentes compartilhados (botões, navegação, exportar…) leem. Cada layout de módulo põe isto
 * no elemento raiz; fora de módulo valem os padrões da Central em `globals.css`.
 */
export function estiloModulo(m: Pick<InfoModulo, "cor" | "corTexto">): CSSProperties {
  return { "--modulo": m.cor, "--modulo-texto": m.corTexto } as CSSProperties;
}
