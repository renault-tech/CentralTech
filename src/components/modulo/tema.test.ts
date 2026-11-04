import { describe, expect, it } from "vitest";

import { estiloModulo } from "@/components/modulo/tema";
import { MODULOS } from "@/lib/modulos-info";

describe("estiloModulo", () => {
  it("expõe a cor do módulo nas duas variáveis que os componentes compartilhados leem", () => {
    expect(estiloModulo(MODULOS.frotas)).toEqual({ "--modulo": "#5C7A1F", "--modulo-texto": "#3F5A12" });
    expect(estiloModulo(MODULOS.emendas)).toEqual({ "--modulo": "#6B4FBB", "--modulo-texto": "#5B3FA8" });
  });

  it("a cor de botão e texto de cada módulo passa de 4,5:1 sobre branco", () => {
    const luminancia = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contraste = (hex: string) => 1.05 / (luminancia(hex) + 0.05);
    for (const m of Object.values(MODULOS)) expect(contraste(m.corTexto), m.nome).toBeGreaterThanOrEqual(4.5);
  });
});
