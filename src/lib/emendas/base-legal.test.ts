import { describe, expect, it } from "vitest";

import { BASES, BASE_DA_PENDENCIA, baseDaPendencia } from "@/lib/emendas/base-legal";

describe("base legal", () => {
  it("toda regra com fundamento aponta para uma base existente", () => {
    for (const chave of Object.values(BASE_DA_PENDENCIA)) expect(BASES[chave]?.citacao).toBeTruthy();
  });
  it("acha a base ignorando o sufixo depois de ':'", () => {
    expect(baseDaPendencia("termo_sem_extrato")).toContain("13.019");
    expect(baseDaPendencia("data_fora_de_ordem:empenho")).toBeUndefined();
  });
});
