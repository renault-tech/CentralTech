import { describe, expect, it } from "vitest";

import { relatorioImpedimentos, relatorioPorVereador, tabelaParaCsv } from "@/lib/emendas/relatorios";
import type { EmendaResumo, Impedimento } from "@/types/emendas";

const e = (o: Partial<EmendaResumo>) =>
  ({ id: "a", numero: 1, vereador_numero: 2, vereador_nome: "Ana", valor: 1000, saude: false, empenhado: 500, liquidado: 0, pago: 250, secretaria_nome: "S", ...o }) as EmendaResumo;

describe("relatorios", () => {
  it("por vereador soma valores e calcula % pago", () => {
    const t = relatorioPorVereador([e({}), e({ id: "b", numero: 2, valor: 1000, saude: true, pago: 750 })]);
    expect(t.linhas).toEqual([["02 · Ana", 2, 2000, 1000, 1000, 0, 1000, "50.0%"]]);
  });
  it("impedimentos: só os em aberto de emendas do recorte", () => {
    const imp = (id: string, resolvido: string | null) => ({ emenda_id: id, tipo: "legal", justificativa: "x", resolvido_em: resolvido }) as Impedimento;
    expect(relatorioImpedimentos([e({})], [imp("a", null), imp("a", "2026-01-01"), imp("z", null)]).linhas).toHaveLength(1);
  });
  it("CSV usa vírgula decimal só nas colunas monetárias", () => {
    const csv = tabelaParaCsv({ titulo: "t", colunas: ["N", "V"], linhas: [[1, 1.5]], monetarias: [1] });
    expect(csv).toContain("1;1,50");
  });
});
