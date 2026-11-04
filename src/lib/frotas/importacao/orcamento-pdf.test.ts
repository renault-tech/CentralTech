import { describe, expect, it } from "vitest";

import { lerDinheiro, lerOrcamentoDoTexto } from "@/lib/frotas/importacao/orcamento-pdf";

const veiculos = [
  { id: "v1", placa: "HLF-6885", modelo: "Strada" },
  { id: "v2", placa: "RIO2A18", modelo: "Onix" },
];
const oficinas = [{ id: "o1", nome: "Auto Center Silva" }];

const texto = `AUTO CENTER SILVA LTDA  CNPJ 12.345.678/0001-90
ORÇAMENTO Nº 552   Data: 03/11/2026
Veículo: Fiat Strada  Placa HLF 6885
Serviço: Troca de embreagem completa
Peças ........ R$ 1.200,00
Mão de obra ... R$ 650,00
Subtotal R$ 1.850,00
TOTAL R$ 1.850,00`;

describe("orçamento em PDF", () => {
  it("lê placa, valor total, data, oficina e serviço", () => {
    const o = lerOrcamentoDoTexto(texto, veiculos, oficinas, "2026-11-04");
    expect(o).toMatchObject({ veiculoId: "v1", oficinaId: "o1", valor: 1850, data: "2026-11-03", servico: "Troca de embreagem completa" });
    expect(o.avisos).toEqual([]);
  });
  it("reconhece placa Mercosul e avisa quando falta ou não está cadastrada", () => {
    expect(lerOrcamentoDoTexto("placa RIO2A18 total R$ 10,00", veiculos, [], "2026-11-04").veiculoId).toBe("v2");
    const sem = lerOrcamentoDoTexto("sem nada útil", veiculos, [], "2026-11-04");
    expect(sem.avisos.length).toBe(3);
    const desc = lerOrcamentoDoTexto("placa ABC-1234 R$ 5,00", veiculos, [], "2026-11-04");
    expect(desc.veiculoId).toBeNull();
    expect(desc.avisos[0]).toContain("ABC-1234");
  });
  it("ignora data futura e lê dinheiro brasileiro", () => {
    expect(lerOrcamentoDoTexto("01/01/2030 e 02/11/2026", veiculos, [], "2026-11-04").data).toBe("2026-11-02");
    expect(lerDinheiro("1.234,56")).toBe(1234.56);
    expect(lerDinheiro("abc")).toBeNull();
  });
});
