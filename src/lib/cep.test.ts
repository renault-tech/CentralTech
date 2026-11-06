import { describe, expect, it } from "vitest";

import { buscarCep, cepDoEndereco, interpretarBrasilApi, interpretarViaCep, mascararCep, montarEndereco, normalizarCep } from "./cep";

const resp = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const VIACEP = { cep: "36770-000", logradouro: "Rua Major Vieira", bairro: "Centro", localidade: "Cataguases", uf: "mg" };

describe("CEP: texto", () => {
  it("normaliza e mascara", () => {
    expect(normalizarCep("36.770-000")).toBe("36770000");
    expect(normalizarCep("3677")).toBeNull();
    expect(mascararCep("36770000")).toBe("36770-000");
    expect(mascararCep("36770")).toBe("36770");
    expect(mascararCep("abc36770-0009999")).toBe("36770-000");
  });
  it("acha o CEP num endereço gravado", () => {
    expect(cepDoEndereco("Rua A, 10 - Centro - Cataguases/MG - CEP 36770-000")).toBe("36770-000");
    expect(cepDoEndereco("Rua A, 10")).toBe("");
  });
});

describe("interpretação das respostas", () => {
  it("ViaCEP: lê e põe a UF em maiúsculas; `erro` vira nulo", () => {
    expect(interpretarViaCep(VIACEP)).toEqual({ cep: "36770000", logradouro: "Rua Major Vieira", bairro: "Centro", cidade: "Cataguases", uf: "MG" });
    expect(interpretarViaCep({ erro: true })).toBeNull();
    expect(interpretarViaCep({ erro: "true" })).toBeNull();
    expect(interpretarViaCep(null)).toBeNull();
  });
  it("CEP geral de cidade pequena (sem logradouro) também vale", () => {
    expect(interpretarViaCep({ cep: "36800-000", logradouro: "", bairro: "", localidade: "Pequena", uf: "MG" })?.logradouro).toBe("");
  });
  it("BrasilAPI", () => {
    expect(interpretarBrasilApi({ cep: "36770000", street: "Rua Major Vieira", neighborhood: "Centro", city: "Cataguases", state: "MG" })).toMatchObject({ cidade: "Cataguases", uf: "MG" });
    expect(interpretarBrasilApi({ message: "x" })).toBeNull();
  });
});

describe("montarEndereco", () => {
  it("compõe com número e complemento", () => {
    expect(montarEndereco({ logradouro: "Rua Major Vieira", numero: "412", complemento: "sala 3", bairro: "Centro", cidade: "Cataguases", uf: "MG", cep: "36770000" })).toBe(
      "Rua Major Vieira, 412, sala 3 - Centro - Cataguases/MG - CEP 36770-000"
    );
  });
  it("omite o que está vazio", () => {
    expect(montarEndereco({ logradouro: "", bairro: "", cidade: "Pequena", uf: "MG", cep: "36800000" })).toBe("Pequena/MG - CEP 36800-000");
    expect(montarEndereco({ logradouro: "Rua A", numero: " ", bairro: "Centro", cidade: "X", uf: "MG", cep: "123" })).toBe("Rua A - Centro - X/MG");
  });
});

describe("buscarCep (com fetch falso)", () => {
  it("usa a primeira fonte quando responde", async () => {
    const chamadas: string[] = [];
    const r = await buscarCep("36770-000", (async (u: RequestInfo | URL) => { chamadas.push(String(u)); return resp(VIACEP); }) as typeof fetch);
    expect(r).toMatchObject({ ok: true, endereco: { cidade: "Cataguases" } });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toContain("viacep");
  });
  it("cai para a BrasilAPI se a ViaCEP falha", async () => {
    const f = (async (u: RequestInfo | URL) => (String(u).includes("viacep") ? Promise.reject(new Error("rede")) : resp({ cep: "36770000", street: "Rua X", neighborhood: "Bairro", city: "Cataguases", state: "MG" }))) as typeof fetch;
    expect(await buscarCep("36770000", f)).toMatchObject({ ok: true, endereco: { logradouro: "Rua X" } });
  });
  it("ViaCEP sem o CEP (erro:true) e BrasilAPI 404 = não encontrado", async () => {
    const f = (async (u: RequestInfo | URL) => (String(u).includes("viacep") ? resp({ erro: true }) : resp({ message: "CEP não encontrado" }, 404))) as typeof fetch;
    expect(await buscarCep("00000000", f)).toEqual({ ok: false, motivo: "nao_encontrado" });
  });
  it("todas as fontes fora do ar = indisponível (não 'não encontrado')", async () => {
    const f = (async () => { throw new Error("sem rede"); }) as typeof fetch;
    expect(await buscarCep("36770000", f)).toEqual({ ok: false, motivo: "indisponivel" });
    expect(await buscarCep("36770000", (async () => resp({}, 503)) as typeof fetch)).toEqual({ ok: false, motivo: "indisponivel" });
  });
  it("CEP inválido nem chama a rede", async () => {
    let chamou = false;
    const r = await buscarCep("123", (async () => { chamou = true; return resp({}); }) as typeof fetch);
    expect(r).toEqual({ ok: false, motivo: "invalido" });
    expect(chamou).toBe(false);
  });
});
