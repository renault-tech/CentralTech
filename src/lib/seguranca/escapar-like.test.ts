import { describe, expect, it } from "vitest";

import { escaparLike } from "@/lib/seguranca/escapar-like";

describe("escaparLike", () => {
  it("deixa texto comum como está", () => {
    expect(escaparLike("maria@prefeitura.gov.br")).toBe("maria@prefeitura.gov.br");
  });
  it("escapa os curingas do LIKE", () => {
    expect(escaparLike("a_b%c")).toBe("a\\_b\\%c");
  });
  it("escapa a própria barra invertida", () => {
    expect(escaparLike("a\\b")).toBe("a\\\\b");
  });
  it("um nome só com % não vira curinga", () => {
    expect(escaparLike("%")).toBe("\\%");
  });
});
