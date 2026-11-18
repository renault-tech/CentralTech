import { describe, expect, it } from "vitest";

import { linhasDeSaldo, porSecretaria, temTipo, totaisDeSaldo, type EmendaParaSaldo } from "@/lib/emendas/saldos";

const base: Omit<EmendaParaSaldo, "id" | "numero" | "valor" | "empenhado" | "pago" | "etapa"> = { objeto: "x", vereador_nome: "V", secretaria_id: "s1", secretaria_nome: "Educação", beneficiario_nome: null, situacao: "normal" };
const emendas: EmendaParaSaldo[] = [
  { ...base, id: "a", numero: 1, valor: 10000, empenhado: 8519.2, pago: 8519.2, etapa: "paga" },
  { ...base, id: "b", numero: 2, valor: 1000, empenhado: 1000, pago: 900, etapa: "concluida", secretaria_id: "s2", secretaria_nome: "Saúde" },
  { ...base, id: "c", numero: 3, valor: 1000, empenhado: 1020, pago: 1020, etapa: "paga" },
  { ...base, id: "d", numero: 4, valor: 5000, empenhado: 100, pago: 0, etapa: "empenhada" },
  { ...base, id: "e", numero: 5, valor: 500, empenhado: 400, pago: 400, etapa: "paga", situacao: "cancelada" },
];

describe("saldos consolidados", () => {
  it("lista só emendas com algo a conciliar (e ignora canceladas)", () => {
    expect(linhasDeSaldo(emendas, []).map((l) => l.numero)).toEqual([1, 2, 3]);
  });
  it("totaliza por tipo e separa registrado de a registrar", () => {
    const conc = [{ id: "a", saldo_registrado_em: "2026-11-18", saldo_valor: 1480.8, saldo_observacao: null, anulacao_solicitada_em: null, anulacao_documento: null, anulacao_valor: null, excesso_valor: null, excesso_fonte: null, excesso_documento: null, conciliado_ipm_em: null, observacao: null }];
    const l = linhasDeSaldo(emendas, conc);
    const t = totaisDeSaldo(l);
    expect(t.naoExecutadoRegistrado).toBe(1480.8);
    expect(t.naoExecutadoARegistrar).toBe(0);
    expect(t.empenhoAAnular).toBe(100);
    expect(t.excesso).toBe(20);
    expect(t.excessoSemFonte).toBe(20);
    expect(temTipo(l[0], "registrado")).toBe(true);
    expect(temTipo(l[1], "anular")).toBe(true);
    expect(temTipo(l[2], "excesso")).toBe(true);
  });
  it("resumo por secretaria", () => {
    const s = porSecretaria(linhasDeSaldo(emendas, []));
    expect(s.find((x) => x.secretaria === "Saúde")?.empenhoAAnular).toBe(100);
    expect(s.find((x) => x.secretaria === "Educação")?.naoExecutado).toBe(1480.8);
    expect(s.find((x) => x.secretaria === "Educação")?.excesso).toBe(20);
  });
});
