import { brl, dataBr } from "@/lib/emendas/regras";

/**
 * Documentos guardados no Google Drive da Prefeitura (nenhum arquivo fica no banco): a tabela
 * `emendas.documentos_drive` só tem o ID do arquivo, a versão e a "ficha". A ficha NÃO é digitada de novo:
 * ela é montada aqui, na hora, a partir dos dados que a emenda já tem (termo, vigência, extrato, anuência…).
 * Assim cada dado tem uma fonte só e a ficha nunca contradiz o cadastro.
 *
 * Arquivo puro (sem `server-only`): usado nas telas internas, no portal e nos testes.
 */

export const TIPOS_DRIVE = ["termo", "plano_trabalho", "extrato", "anuencia_sus", "relatorio_gestao", "jornal_edicao"] as const;
export type TipoDrive = (typeof TIPOS_DRIVE)[number];

/** Só estes tipos podem aparecer no portal sem login. Certidões, RG, orçamentos e demais anexos nunca entram. */
export const TIPOS_DRIVE_PUBLICOS: readonly TipoDrive[] = ["termo", "plano_trabalho", "extrato", "anuencia_sus", "relatorio_gestao"];

export const ROTULO_DRIVE: Record<TipoDrive, string> = {
  termo: "Termo de fomento",
  plano_trabalho: "Plano de trabalho",
  extrato: "Extrato publicado",
  anuencia_sus: "Anuência do SUS",
  relatorio_gestao: "Relatório de gestão",
  jornal_edicao: "Edição do Jornal Oficial",
};

export type DocumentoDrive = {
  id: string;
  tipo: TipoDrive;
  titulo: string;
  drive_file_id: string;
  drive_versao: string | null;
  publico: boolean;
  conferido_em: string | null;
};

/** Endereço do arquivo no Drive. Só o arquivo (nunca a pasta): quem abre não vê os outros. */
export function urlOriginal(driveFileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`;
}

/**
 * Aceita o link copiado do Drive (`/file/d/ID/view`, `open?id=ID`, `uc?id=ID`) ou o próprio ID e devolve só o ID.
 * Links de PASTA (`/folders/…`) são recusados: o cadastro liga um arquivo, nunca a pasta inteira.
 */
export function extrairIdDrive(texto: string): string | null {
  const t = texto.trim();
  if (!t || /\/folders\//.test(t)) return null;
  const m = /\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/.exec(t) ?? /[?&]id=([A-Za-z0-9_-]+)/.exec(t);
  const id = m ? m[1] : /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
  return id && idDriveValido(id) ? id : null;
}

/** Só caracteres que o Drive usa em IDs; evita montar link com lixo. */
export function idDriveValido(id: string): boolean {
  return /^[A-Za-z0-9_-]{20,80}$/.test(id);
}

export type DocumentoExigido = { tipo: TipoDrive; rotulo: string; base: string };

const EXIGIDOS = {
  termo: { tipo: "termo", rotulo: ROTULO_DRIVE.termo, base: "Lei 13.019/2014, arts. 29 e 42" },
  plano_trabalho: { tipo: "plano_trabalho", rotulo: ROTULO_DRIVE.plano_trabalho, base: "Lei 13.019/2014, art. 22 · IN TCE-MG 05/2025, art. 7º, IX" },
  extrato: { tipo: "extrato", rotulo: ROTULO_DRIVE.extrato, base: "Lei 13.019/2014, art. 38" },
  relatorio_gestao: { tipo: "relatorio_gestao", rotulo: ROTULO_DRIVE.relatorio_gestao, base: "IN TCE-MG 05/2025, art. 7º, X" },
  anuencia_sus: { tipo: "anuencia_sus", rotulo: ROTULO_DRIVE.anuencia_sus, base: "IN TCE-MG 05/2025, art. 7º, XVII" },
} as const satisfies Record<string, DocumentoExigido>;

/**
 * Documentos que a lei exige para a emenda, conforme o tipo de execução. Execução direta não tem parceria
 * (sem termo, plano ou extrato). A anuência do SUS só vale para emenda de saúde ou quando já foi registrada.
 * Isto substitui a lista genérica de itens: aqui só entra o que tem base legal e vai a público.
 */
export function documentosExigidos(
  tipoExecucao: "direta" | "osc" | "ente",
  opcoes: { saude: boolean; anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null }
): DocumentoExigido[] {
  if (tipoExecucao === "direta") return [];
  const lista: DocumentoExigido[] = [EXIGIDOS.termo, EXIGIDOS.plano_trabalho, EXIGIDOS.extrato, EXIGIDOS.relatorio_gestao];
  if ((opcoes.saude || opcoes.anuenciaSus === "sim") && opcoes.anuenciaSus !== "nao_se_aplica") lista.push(EXIGIDOS.anuencia_sus);
  return lista;
}

export type ContextoFicha = {
  numero: number;
  valor: number;
  vereador: string | null;
  beneficiario: string | null;
  objeto: string | null;
  termo: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  extratoPublicadoEm: string | null;
  gestorPrefeitura: string | null;
  conta: string | null;
  anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null;
  anuenciaSusData?: string | null;
  planoMetas: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  planoOutrasFontes: number | null;
};

export type CampoFicha = { rotulo: string; valor: string | null; largo?: boolean };
export type Ficha = { titulo: string; campos: CampoFicha[]; base: string };

const SUS = { sim: "Sim, houve anuência prévia do gestor do SUS", nao: "Não houve anuência prévia", nao_se_aplica: "Não se aplica" } as const;

function periodo(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  return `${a ? dataBr(a) : "—"} a ${b ? dataBr(b) : "—"}`;
}

/** "E193 - ANUENCIA-SUS - oficio 0900-2026.pdf" → "0900/2026". */
export function numeroDoOficio(titulo: string): string | null {
  const m = /of[ií]cio\s+(\d{3,5})-(\d{4})/i.exec(titulo);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function montarFicha(doc: Pick<DocumentoDrive, "tipo" | "titulo">, c: ContextoFicha): Ficha {
  const autor = c.vereador ? `${c.vereador} · emenda nº ${c.numero}` : `Emenda nº ${c.numero}`;
  switch (doc.tipo) {
    case "termo":
      return {
        titulo: c.termo ? `Termo de fomento nº ${c.termo}` : "Termo de fomento",
        base: "Lei 13.019/2014, arts. 29, 38 e 42 · IN TCE-MG 05/2025, art. 7º",
        campos: [
          { rotulo: "Número do termo", valor: c.termo },
          { rotulo: "Valor do repasse", valor: brl(c.valor) },
          { rotulo: "Organização da sociedade civil", valor: c.beneficiario },
          { rotulo: "Autor da emenda", valor: autor },
          { rotulo: "Vigência", valor: periodo(c.vigenciaInicio, c.vigenciaFim) },
          { rotulo: "Extrato publicado em", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
          { rotulo: "Gestor da parceria", valor: c.gestorPrefeitura },
          { rotulo: "Conta bancária específica", valor: c.conta, largo: true },
        ],
      };
    case "plano_trabalho":
      return {
        titulo: c.beneficiario ? `Plano de trabalho — ${c.beneficiario}` : "Plano de trabalho",
        base: "Lei 13.019/2014, art. 22 · IN TCE-MG 05/2025, art. 7º",
        campos: [
          { rotulo: "Objeto da parceria", valor: c.objeto, largo: true },
          { rotulo: "Finalidade e metas", valor: c.planoMetas, largo: true },
          { rotulo: "Valor total", valor: brl(c.valor) },
          { rotulo: "Outras fontes de recurso", valor: c.planoOutrasFontes != null && c.planoOutrasFontes > 0 ? brl(c.planoOutrasFontes) : "Nenhuma informada" },
          { rotulo: "Cronograma previsto", valor: periodo(c.inicioPrevisto, c.terminoPrevisto) },
          { rotulo: "Anuência do SUS", valor: c.anuenciaSus ? SUS[c.anuenciaSus] : null },
        ],
      };
    case "extrato":
      return {
        titulo: c.termo ? `Extrato do termo nº ${c.termo}` : "Extrato do termo de fomento",
        base: "Lei 13.019/2014, art. 38 (publicação do extrato) · IN TCE-MG 05/2025, art. 7º",
        campos: [
          { rotulo: "Termo", valor: c.termo },
          { rotulo: "Valor do repasse", valor: brl(c.valor) },
          { rotulo: "Organização da sociedade civil", valor: c.beneficiario },
          { rotulo: "Vigência", valor: periodo(c.vigenciaInicio, c.vigenciaFim) },
          { rotulo: "Publicado em", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
        ],
      };
    case "anuencia_sus": {
      const of = numeroDoOficio(doc.titulo);
      return {
        titulo: of ? `Anuência do SUS — ofício ${of}` : "Anuência do SUS",
        base: "IN TCE-MG 05/2025, art. 7º, XVII",
        campos: [
          { rotulo: "Anuência prévia do gestor do SUS", valor: c.anuenciaSus ? SUS[c.anuenciaSus] : null, largo: true },
          { rotulo: "Ofício", valor: of },
          { rotulo: "Data da anuência", valor: c.anuenciaSusData ? dataBr(c.anuenciaSusData) : null },
          { rotulo: "Organização da sociedade civil", valor: c.beneficiario },
          { rotulo: "Valor da emenda", valor: brl(c.valor) },
        ],
      };
    }
    case "relatorio_gestao":
      return {
        titulo: "Relatório de gestão",
        base: "IN TCE-MG 05/2025, art. 7º, X",
        campos: [
          { rotulo: "Emenda", valor: autor },
          { rotulo: "Organização da sociedade civil", valor: c.beneficiario },
        ],
      };
    case "jornal_edicao":
      return {
        titulo: "Edição do Jornal Oficial",
        base: "Lei 13.019/2014, art. 38",
        campos: [
          { rotulo: "Publicação do extrato", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
          { rotulo: "Termo", valor: c.termo },
        ],
      };
  }
}
