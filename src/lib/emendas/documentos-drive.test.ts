import { describe, expect, it } from "vitest";

import { TIPOS_DRIVE, TIPOS_DRIVE_PUBLICOS, documentosExigidos, extrairIdDrive, idDriveValido, montarFicha, numeroDoOficio, urlOriginal, type ContextoFicha } from "./documentos-drive";

const ctx: ContextoFicha = {
  numero: 82,
  valor: 11000,
  vereador: "Giovanni Gropo",
  beneficiario: "Hospital de Cataguases",
  objeto: "Apoio às atividades assistenciais",
  termo: "031/2026",
  vigenciaInicio: "2026-03-20",
  vigenciaFim: "2027-03-20",
  extratoPublicadoEm: "2026-03-29",
  gestorPrefeitura: "Matheus Moutinho Crepalde",
  conta: "Caixa Econômica Federal Agência 0108 Conta 570577698-1",
  anuenciaSus: "sim",
  anuenciaSusData: "2026-11-09",
  planoMetas: "Manter o atendimento",
  inicioPrevisto: null,
  terminoPrevisto: null,
  planoOutrasFontes: 0,
};

describe("documentos do Drive", () => {
  it("o link abre só o arquivo, nunca a pasta", () => {
    const u = urlOriginal("1ABCdef_ghi-JKLmnopqrst");
    expect(u).toBe("https://drive.google.com/file/d/1ABCdef_ghi-JKLmnopqrst/view");
    expect(u).not.toContain("folders");
  });

  it("só aceita ID de Drive com formato válido", () => {
    expect(idDriveValido("1ABCdef_ghi-JKLmnopqrst")).toBe(true);
    expect(idDriveValido("../etc/passwd")).toBe(false);
    expect(idDriveValido("curto")).toBe(false);
    expect(idDriveValido("a b c d e f g h i j k l m n o p")).toBe(false);
  });

  it("o portal nunca publica certidão, RG ou documento interno", () => {
    expect(TIPOS_DRIVE_PUBLICOS).not.toContain("jornal_edicao" as never);
    for (const t of TIPOS_DRIVE_PUBLICOS) expect(TIPOS_DRIVE).toContain(t);
    expect(TIPOS_DRIVE_PUBLICOS.every((t) => ["termo", "plano_trabalho", "extrato", "anuencia_sus", "relatorio_gestao", "convenio"].includes(t))).toBe(true);
  });

  it("extrai o número do ofício do nome do arquivo", () => {
    expect(numeroDoOficio("E193 - ANUENCIA-SUS - oficio 0900-2026.pdf")).toBe("0900/2026");
    expect(numeroDoOficio("E001 - TERMO - 027-2026.pdf")).toBeNull();
  });

  it("documentos exigidos por lei dependem do tipo de execução", () => {
    expect(documentosExigidos("direta", { saude: false, anuenciaSus: null })).toEqual([]);
    expect(documentosExigidos("osc", { saude: false, anuenciaSus: null }).map((d) => d.tipo)).toEqual(["termo", "plano_trabalho", "extrato", "relatorio_gestao"]);
    expect(documentosExigidos("osc", { saude: true, anuenciaSus: null }).map((d) => d.tipo)).toContain("anuencia_sus");
    expect(documentosExigidos("osc", { saude: true, anuenciaSus: "nao_se_aplica" }).map((d) => d.tipo)).not.toContain("anuencia_sus");
    expect(documentosExigidos("osc", { saude: false, anuenciaSus: "sim" }).map((d) => d.tipo)).toContain("anuencia_sus");
    for (const d of documentosExigidos("osc", { saude: true, anuenciaSus: null })) expect(d.base.length).toBeGreaterThan(5);
  });

  it("convênio (contrato de rateio) exige o instrumento e a publicação, sem termo nem plano do MROSC", () => {
    const tipos = (i?: "termo_fomento" | "convenio", saude = false) => documentosExigidos("ente", { saude, anuenciaSus: null, instrumento: i }).map((d) => d.tipo);
    expect(tipos("convenio")).toEqual(["convenio", "extrato", "relatorio_gestao"]);
    expect(tipos("convenio")).not.toContain("termo");
    expect(tipos("convenio")).not.toContain("plano_trabalho");
    expect(tipos("convenio", true)).toContain("anuencia_sus");
    expect(tipos("termo_fomento")).toEqual(["termo", "plano_trabalho", "extrato", "relatorio_gestao"]);
    expect(tipos(undefined)).toEqual(tipos("termo_fomento"));
    for (const d of documentosExigidos("ente", { saude: false, anuenciaSus: null, instrumento: "convenio" })) expect(d.base).not.toMatch(/13\.019/);
  });

  it("a ficha do convênio e da sua publicação não cita a Lei 13.019", () => {
    const c = { ...ctx, instrumento: "convenio" as const };
    const f = montarFicha({ tipo: "convenio", titulo: "E093 - CONVENIO - rateio.pdf" }, c);
    expect(f.titulo).toMatch(/Convênio/);
    expect(f.base).not.toMatch(/13\.019/);
    const e = montarFicha({ tipo: "extrato", titulo: "E093 - EXTRATO.pdf" }, c);
    expect(e.titulo).toMatch(/Publicação do convênio/);
    expect(e.base).not.toMatch(/13\.019/);
    expect(montarFicha({ tipo: "extrato", titulo: "x" }, ctx).base).toMatch(/13\.019/);
  });

  it("monta a ficha do termo a partir do cadastro", () => {
    const f = montarFicha({ tipo: "termo", titulo: "E082 - TERMO - 031-2026.pdf" }, ctx);
    expect(f.titulo).toBe("Termo de fomento nº 031/2026");
    const por = Object.fromEntries(f.campos.map((c) => [c.rotulo, c.valor]));
    expect(por["Vigência"]).toBe("20/03/2026 a 20/03/2027");
    expect(por["Extrato publicado em"]).toBe("29/03/2026");
    expect(por["Gestor da parceria"]).toBe("Matheus Moutinho Crepalde");
    expect(f.base).toContain("13.019");
  });

  it("dado ausente fica vazio (a tela mostra 'Não informado'), nunca inventado", () => {
    const f = montarFicha({ tipo: "termo", titulo: "x" }, { ...ctx, termo: null, extratoPublicadoEm: null, conta: null });
    expect(f.titulo).toBe("Termo de fomento");
    expect(f.campos.find((c) => c.rotulo === "Extrato publicado em")?.valor).toBeNull();
    expect(f.campos.find((c) => c.rotulo.startsWith("Conta"))?.valor).toBeNull();
  });

  it("ficha da anuência traz ofício e data", () => {
    const f = montarFicha({ tipo: "anuencia_sus", titulo: "E060 - ANUENCIA-SUS - oficio 0889-2026.pdf" }, ctx);
    expect(f.titulo).toBe("Anuência do SUS — ofício 0889/2026");
    expect(f.campos.find((c) => c.rotulo === "Data da anuência")?.valor).toBe("09/11/2026");
  });

  it("ficha do plano mostra 'Nenhuma informada' sem outras fontes", () => {
    const f = montarFicha({ tipo: "plano_trabalho", titulo: "x" }, ctx);
    expect(f.campos.find((c) => c.rotulo === "Outras fontes de recurso")?.valor).toBe("Nenhuma informada");
  });
});

describe("extrairIdDrive", () => {
  const id = "1B32gyvWl5W2EUTxNuDpIiimmLwups7th";
  it("lê link de arquivo, open?id e o próprio ID", () => {
    expect(extrairIdDrive(`https://drive.google.com/file/d/${id}/view?usp=sharing`)).toBe(id);
    expect(extrairIdDrive(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(extrairIdDrive(`  ${id} `)).toBe(id);
  });
  it("recusa pasta, texto solto e ID curto", () => {
    expect(extrairIdDrive("https://drive.google.com/drive/folders/1qU5X18EmHo4eIiLyApF2Fnk5wjMHQHO-")).toBeNull();
    expect(extrairIdDrive("meu documento")).toBeNull();
    expect(extrairIdDrive("abc123")).toBeNull();
    expect(extrairIdDrive("")).toBeNull();
  });
});
