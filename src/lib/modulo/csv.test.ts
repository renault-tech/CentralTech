import { describe, expect, it } from "vitest";

import { listaParaCsv } from "./csv";

describe("listaParaCsv", () => {
  it("usa ; e vírgula decimal, protege aspas e fórmulas e começa com BOM", () => {
    const csv = listaParaCsv([{ titulo: "Nome", valor: (i: { n: string; v: number | null }) => i.n }, { titulo: "Valor", valor: (i) => i.v }], [{ n: 'Ana; "A"', v: 12.5 }, { n: "=SOMA(A1)", v: null }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toEqual(["﻿Nome;Valor", '"Ana; ""A""";12,5', "'=SOMA(A1);", ""]);
  });
});
