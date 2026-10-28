import { describe, expect, it } from "vitest";

import { escaparHtml, htmlConfirmarLink } from "@/lib/seguranca/pagina-confirmar";

describe("escaparHtml", () => {
  it("escapa os caracteres que quebram atributos e tags", () => {
    expect(escaparHtml(`<a href="x" onclick='y'>&`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
  });
});

describe("htmlConfirmarLink", () => {
  const html = htmlConfirmarLink({
    acao: "/auth/confirm",
    campos: { token_hash: 'abc"><script>alert(1)</script>', type: "recovery", next: "/redefinir-senha" },
    titulo: "Redefinir senha",
    texto: "Clique para continuar.",
    botao: "Continuar",
  });

  it("usa POST na mesma rota e não valida nada no GET", () => {
    expect(html).toContain('method="post" action="/auth/confirm"');
  });
  it("não deixa um token malicioso injetar HTML", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("abc&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  it("reenvia os campos como hidden", () => {
    expect(html).toContain('name="type" value="recovery"');
    expect(html).toContain('name="next" value="/redefinir-senha"');
  });
});
