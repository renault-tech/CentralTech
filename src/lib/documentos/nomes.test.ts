import { describe, expect, it } from "vitest";

import { limparNome, nomeComData, nomeDocumento } from "@/lib/documentos/nomes";

describe("nomes de documentos", () => {
  it("termo com número", () => {
    expect(nomeDocumento({ tipo: "termo", numeroEmenda: 20, ano: 2026, numeroTermo: "070/2026", sufixo: "original" })).toBe("E020 - TERMO - 070-2026 (original).pdf");
  });
  it("sem número do termo usa o ano", () => {
    expect(nomeDocumento({ tipo: "termo", numeroEmenda: 5, ano: 2026 })).toBe("E005 - TERMO - 2026.pdf");
  });
  it("tipos que não têm número usam o ano", () => {
    expect(nomeDocumento({ tipo: "nota_fiscal", numeroEmenda: 118, ano: 2026, extensao: "PDF" })).toBe("E118 - NOTA FISCAL - 2026.pdf");
    expect(nomeDocumento({ tipo: "extrato", numeroEmenda: 1, ano: 2026, sufixo: "versao publica" })).toBe("E001 - EXTRATO - 2026 (versao publica).pdf");
  });
  it("limpa caracteres proibidos", () => {
    expect(limparNome('a/b:c*"d')).toBe("a-b-c-d");
  });
  it("acrescenta a data antes da extensão", () => {
    expect(nomeComData("E001 - TERMO - 2026.pdf", new Date("2026-11-28T12:00:00Z"))).toBe("E001 - TERMO - 2026 [2026-11-28].pdf");
  });
});
