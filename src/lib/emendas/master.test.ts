import { describe, expect, it } from "vitest";

import { podeDecidirComoMaster } from "@/lib/emendas/master-regra";

const base = { adminHub: false, ehMaster: false, haMasters: false, gestor: true };

describe("podeDecidirComoMaster", () => {
  it("administrador da Central sempre pode", () => {
    expect(podeDecidirComoMaster({ ...base, adminHub: true, haMasters: true })).toBe(true);
  });
  it("sem nenhum master cadastrado, o gestor segue decidindo", () => {
    expect(podeDecidirComoMaster(base)).toBe(true);
  });
  it("com master cadastrado, só o master (gestor comum não)", () => {
    expect(podeDecidirComoMaster({ ...base, haMasters: true })).toBe(false);
    expect(podeDecidirComoMaster({ ...base, haMasters: true, ehMaster: true })).toBe(true);
  });
  it("quem não é gestor nunca decide", () => {
    expect(podeDecidirComoMaster({ ...base, gestor: false })).toBe(false);
    expect(podeDecidirComoMaster({ ...base, gestor: false, ehMaster: true, haMasters: true })).toBe(false);
  });
});
