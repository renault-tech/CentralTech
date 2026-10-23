import { describe, expect, it } from "vitest";

import { montarMarkdown, nomeAnexo, type ItemExportado } from "@/lib/feedback/exportar";

const base: ItemExportado = {
  item: {
    id: "abc", app: "compras", usuario_id: "u", autor_nome: "Ana", autor_email: "a@x.br", tipo: "suporte",
    mensagem: "Botão não abre\nna tela de contratos", pagina: "/contratos", anexos: ["u/1.png"], status: "novo",
    criado_em: "2026-10-01T15:00:00Z", atualizado_em: null,
  },
  anexos: [{ caminho: "u/1.png", arquivo: "001-compras-1.png" }],
  anexosFalhos: 0,
};

describe("exportar feedback", () => {
  it("nomeia anexos com número, app e extensão", () => {
    expect(nomeAnexo(3, "numera", 1, "numera/x/foto.JPG")).toBe("003-numera-2.jpg");
  });
  it("gera markdown com contexto, citação e imagem", () => {
    const md = montarMarkdown([base], "todos");
    expect(md).toContain("## 1. Compras · Suporte");
    expect(md).toContain("**Tela:** /contratos");
    expect(md).toContain("> na tela de contratos");
    expect(md).toContain("![001-compras-1.png](anexos/001-compras-1.png)");
  });
  it("avisa anexos que falharam", () => {
    expect(montarMarkdown([{ ...base, anexos: [], anexosFalhos: 2 }], "x")).toContain("2 anexo(s) não puderam");
  });
});
