import { describe, expect, it } from "vitest";

import { limiteDoZoom, normalizarZoom, passoVizinho, PASSOS_ZOOM, SCRIPT_ZOOM_INICIAL, zoomAplicado } from "@/lib/zoom";

describe("zoom", () => {
  it("só aceita os passos oferecidos; o resto vira 100", () => {
    expect(normalizarZoom(125)).toBe(125);
    expect(normalizarZoom("150")).toBe(150);
    expect(normalizarZoom(130)).toBe(100);
    expect(normalizarZoom("abc")).toBe(100);
    expect(normalizarZoom(null)).toBe(100);
    expect(normalizarZoom(undefined)).toBe(100);
  });

  it("a largura da tela limita o zoom: celular até 125%, notebook e monitor até 200%", () => {
    expect(limiteDoZoom(360)).toBe(125);
    expect(limiteDoZoom(390)).toBe(125);
    expect(limiteDoZoom(320)).toBe(110);
    expect(limiteDoZoom(280)).toBe(100);
    expect(limiteDoZoom(100)).toBe(100);
    expect(limiteDoZoom(768)).toBe(200);
    expect(limiteDoZoom(1920)).toBe(200);
  });

  it("vale a preferência limitada pela tela, sem perdê-la", () => {
    expect(zoomAplicado(175, 1280)).toBe(175);
    expect(zoomAplicado(175, 390)).toBe(125);
    expect(zoomAplicado(175, 1280)).toBe(175);
    expect(zoomAplicado(undefined, 1280)).toBe(100);
  });

  it("passo a passo, parando em 100 e no limite", () => {
    expect(passoVizinho(100, 1, 200)).toBe(110);
    expect(passoVizinho(110, 1, 200)).toBe(125);
    expect(passoVizinho(200, 1, 200)).toBe(200);
    expect(passoVizinho(100, -1, 200)).toBe(100);
    expect(passoVizinho(125, 1, 125)).toBe(125);
    expect(passoVizinho(150, -1, 200)).toBe(125);
    expect(PASSOS_ZOOM[0]).toBe(100);
  });

  it("o script do <head> faz o mesmo cálculo", () => {
    const rodar = (guardado: string | null, largura: number) => {
      const estilo: { fontSize?: string } = {};
      new Function("localStorage", "window", "document", SCRIPT_ZOOM_INICIAL)(
        { getItem: () => guardado },
        { innerWidth: largura },
        { documentElement: { style: estilo } }
      );
      return estilo.fontSize;
    };
    expect(rodar("150", 1280)).toBe("150%");
    expect(rodar("175", 390)).toBe("125%");
    expect(rodar("100", 1280)).toBeUndefined();
    expect(rodar(null, 1280)).toBeUndefined();
    expect(rodar("999", 1280)).toBeUndefined();
    for (const p of PASSOS_ZOOM) for (const w of [280, 320, 360, 390, 768, 1280]) {
      const esperado = zoomAplicado(p, w);
      expect(rodar(String(p), w) ?? "100%").toBe(`${esperado}%`);
    }
    expect(() => new Function("localStorage", "window", "document", SCRIPT_ZOOM_INICIAL)({ getItem: () => { throw new Error("bloqueado"); } }, { innerWidth: 1280 }, {})).not.toThrow();
  });
});
