import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lerPlanilhaContas, type AbaBruta, type Celula } from "./planilha-contas";
import { chaveLinha, montarPrevia, planejarGravacao, type DecisoesImportacao, type Existentes } from "./plano-contas";

/**
 * Conferência OPCIONAL com as planilhas de controle de verdade (Energisa e COPASA). Só roda quando `PLANILHAS_REAIS` aponta para
 * uma pasta com os dois .xlsx (nomes com "Energisa" e "COPASA"); sem isso, é pulado. Não depende de banco: usa um catálogo vazio.
 *   PLANILHAS_REAIS=/pasta/com/as/planilhas npx vitest run src/lib/imoveis/importacao/planilhas-reais.test.ts
 */
const pasta = process.env.PLANILHAS_REAIS;

async function abasDo(caminho: string): Promise<AbaBruta[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(caminho) as unknown as ArrayBuffer);
  return wb.worksheets.map((ws) => {
    const linhas: Celula[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const c: Celula[] = [];
      for (let col = 1; col <= 40; col++) {
        const v = row.getCell(col).value as unknown;
        c[col - 1] = v === null || v === undefined ? null : typeof v === "object" ? ((v as { result?: Celula }).result ?? null) : (v as Celula);
      }
      linhas[n - 1] = c;
    });
    return { nome: ws.name, linhas: Array.from(linhas, (l) => l ?? []) };
  });
}

describe.skipIf(!pasta || !existsSync(pasta))("planilhas reais de controle", () => {
  const catalogo = ["Administração", "Agricultura", "Assistência Social", "Cultura", "Educação", "Esporte", "Fazenda", "Gabinete do Prefeito", "Saúde", "Serviços Urbanos", "Obras"];
  const ex: Existentes = { secretarias: catalogo.map((n, i) => ({ id: `s${i}`, nome: n })), imoveis: [], unidades: [], contas: [] };

  for (const [marca, tipo] of [["energisa", "luz"], ["copasa", "agua"]] as const) {
    it(`${tipo}: lê, planeja e não perde nem duplica unidades`, async () => {
      const arquivo = readdirSync(pasta as string).find((f) => f.toLowerCase().includes(marca) && f.endsWith(".xlsx"));
      expect(arquivo, `arquivo com "${marca}" na pasta`).toBeTruthy();
      const lido = lerPlanilhaContas(await abasDo(join(pasta as string, arquivo as string)));
      const linhas = lido.abas.flatMap((a) => a.linhas);
      const previa = montarPrevia(lido.abas, tipo, 2026, ex);
      const dec: DecisoesImportacao = {
        tipo,
        ano: 2026,
        vinculo: "proprio",
        abas: Object.fromEntries(previa.map((a) => [a.nome, a.secretariaSugerida ?? "novo"])),
        linhas: Object.fromEntries(linhas.map((l) => [chaveLinha(l), { incluir: true, imovelId: null }])),
      };
      const p = planejarGravacao(lido.abas, dec, ex);
      console.log(
        `[${tipo}] abas=${lido.abas.length} linhas=${linhas.length} ignoradas=${linhas.filter((l) => l.ignorada).length} ` +
          `secretariasNovas=${JSON.stringify(p.secretariasNovas)} imoveisNovos=${p.imoveisNovos.length} unidadesNovas=${p.unidadesNovas.length} ` +
          `contas=${p.contas.length} soma=R$${p.contas.reduce((s, c) => s + c.valor, 0).toFixed(2)} avisos=${p.avisos.length}`
      );
      for (const a of previa) console.log(`  ${a.nome.padEnd(15)} -> ${a.secretariaSugerida ?? "(escolher)"} (${a.linhas.length} linhas)`);
      for (const a of p.avisos.slice(0, 5)) console.log("  aviso:", a);
      expect(linhas.length).toBeGreaterThan(50);
      expect(p.contas.every((c) => c.valor >= 0 && /^2026-\d{2}-01$/.test(c.referencia))).toBe(true);
    });
  }
});
