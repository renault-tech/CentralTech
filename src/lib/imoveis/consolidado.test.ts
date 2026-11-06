import { describe, expect, it } from "vitest";

import { linhasConsolidadas } from "./consolidado";
import { PARAMETROS_PADRAO, somarMeses } from "./regras";
import type { Conta, Imovel, Unidade } from "@/types/imoveis";

const imovel = { id: "i1", nome: "CRAS", secretaria_id: "s" } as Imovel;
const unid = (id: string, tipo: "agua" | "luz") => ({ id, imovel_id: "i1", tipo, numero: id }) as Unidade;
const conta = (unidade_id: string, ref: string, consumo: number) => ({ id: `${unidade_id}${ref}`, unidade_id, referencia: ref, consumo, valor: consumo * 8 }) as Conta;

describe("linhasConsolidadas", () => {
  const ref = "2026-11-01";
  const contas = [100, 100, 100, 100, 100, 100, 190].map((c, i) => conta("u1", somarMeses(ref, i - 6), c));
  it("separa por tipo e acusa a anomalia do mês", () => {
    const l = linhasConsolidadas("luz", ref, [imovel], [unid("u1", "luz"), unid("u2", "agua")], contas, PARAMETROS_PADRAO);
    expect(l).toHaveLength(1);
    expect(l[0].anomalias[0]).toMatchObject({ tipo: "acima" });
    expect(Math.round(l[0].variacao ?? 0)).toBe(90);
  });
  it("unidade sem conta no mês aparece sem anomalia", () => {
    const l = linhasConsolidadas("luz", "2027-01-01", [imovel], [unid("u1", "luz")], contas, PARAMETROS_PADRAO);
    expect(l[0].conta).toBeNull();
    expect(l[0].anomalias).toEqual([]);
  });
});
