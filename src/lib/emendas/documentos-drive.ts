import { brl, dataBr } from "@/lib/emendas/regras";

/**
 * Documentos guardados no Google Drive da Prefeitura (nenhum arquivo fica no banco): a tabela
 * `emendas.documentos_drive` só tem o ID do arquivo, a versão e a "ficha". A ficha NÃO é digitada de novo:
 * ela é montada aqui, na hora, a partir dos dados que a emenda já tem (termo, vigência, extrato, anuência…).
 * Assim cada dado tem uma fonte só e a ficha nunca contradiz o cadastro.
 *
 * Arquivo puro (sem `server-only`): usado nas telas internas, no portal e nos testes.
 */

export const TIPOS_DRIVE = ["termo", "plano_trabalho", "extrato", "extrato_saneador", "anuencia_sus", "relatorio_gestao", "jornal_edicao", "convenio", "nota_fiscal", "prestacao_contas"] as const;
export type TipoDrive = (typeof TIPOS_DRIVE)[number];

/** Só estes tipos podem aparecer no portal sem login. Certidões, RG, orçamentos e demais anexos nunca entram. */
export const TIPOS_DRIVE_PUBLICOS: readonly TipoDrive[] = ["termo", "plano_trabalho", "extrato", "extrato_saneador", "anuencia_sus", "relatorio_gestao", "convenio"];

export const ROTULO_DRIVE: Record<TipoDrive, string> = {
  termo: "Termo de fomento",
  plano_trabalho: "Plano de trabalho",
  extrato: "Extrato publicado",
  extrato_saneador: "Extrato saneador (publicação de regularização)",
  anuencia_sus: "Anuência do SUS",
  relatorio_gestao: "Relatório de gestão",
  jornal_edicao: "Edição do Jornal Oficial",
  convenio: "Convênio / contrato de rateio",
  nota_fiscal: "Nota fiscal com atesto (cumprimento)",
  prestacao_contas: "Prestação de contas (cumprimento)",
};

/** Instrumento da parceria: termo de fomento/colaboração (MROSC) ou convênio (ex.: contrato de rateio com consórcio público). */
export type Instrumento = "termo_fomento" | "convenio";
export const ROTULO_INSTRUMENTO: Record<Instrumento, string> = {
  termo_fomento: "Termo de fomento ou de colaboração",
  convenio: "Convênio (contrato de rateio)",
};

export type DocumentoDrive = {
  id: string;
  tipo: TipoDrive;
  titulo: string;
  drive_file_id: string;
  drive_versao: string | null;
  publico: boolean;
  conferido_em: string | null;
  /** Resultado da leitura automática do PDF (quando houve problema). */
  leitura_aviso?: string | null;
  /** Nºs de outras emendas que têm este MESMO arquivo ligado (calculado na leitura do detalhe). */
  tambem_em?: number[];
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
  convenio: { tipo: "convenio", rotulo: ROTULO_DRIVE.convenio, base: "Lei 11.107/2005, art. 8º · IN TCE-MG 05/2025, art. 7º, VIII" },
  extrato_convenio: { tipo: "extrato", rotulo: ROTULO_DRIVE.extrato, base: "IN TCE-MG 05/2025, art. 7º, VIII (publicidade do instrumento)" },
} as const satisfies Record<string, DocumentoExigido>;

/**
 * Documentos que a lei exige para a emenda, conforme o tipo de execução. Execução direta não tem parceria
 * (sem termo, plano ou extrato). A anuência do SUS só vale para emenda de saúde ou quando já foi registrada.
 * Isto substitui a lista genérica de itens: aqui só entra o que tem base legal e vai a público.
 */
export function documentosExigidos(
  tipoExecucao: "direta" | "osc" | "ente",
  opcoes: { saude: boolean; anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null; instrumento?: Instrumento | null }
): DocumentoExigido[] {
  if (tipoExecucao === "direta") return [];
  // Convênio (contrato de rateio com consórcio): não é parceria do MROSC, então não há termo de fomento, plano de
  // trabalho nem extrato do art. 38 da Lei 13.019; exige-se o próprio convênio, a publicação e o relatório de gestão.
  const lista: DocumentoExigido[] =
    opcoes.instrumento === "convenio"
      ? [EXIGIDOS.convenio, EXIGIDOS.extrato_convenio, EXIGIDOS.relatorio_gestao]
      : [EXIGIDOS.termo, EXIGIDOS.plano_trabalho, EXIGIDOS.extrato, EXIGIDOS.relatorio_gestao];
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
  /** Publicação do extrato saneador (quando o extrato original saiu depois do repasse). */
  extratoSaneadorEm?: string | null;
  gestorPrefeitura: string | null;
  conta: string | null;
  anuenciaSus: "sim" | "nao" | "nao_se_aplica" | null;
  anuenciaSusData?: string | null;
  planoMetas: string | null;
  inicioPrevisto: string | null;
  terminoPrevisto: string | null;
  planoOutrasFontes: number | null;
  instrumento?: Instrumento | null;
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
    case "convenio":
      return {
        titulo: c.termo ? `Convênio / contrato de rateio nº ${c.termo}` : "Convênio / contrato de rateio",
        base: "Lei 11.107/2005, art. 8º · IN TCE-MG 05/2025, art. 7º",
        campos: [
          { rotulo: "Número do instrumento", valor: c.termo },
          { rotulo: "Valor do repasse", valor: brl(c.valor) },
          { rotulo: "Ente ou consórcio beneficiário", valor: c.beneficiario },
          { rotulo: "Autor da emenda", valor: autor },
          { rotulo: "Vigência", valor: periodo(c.vigenciaInicio, c.vigenciaFim) },
          { rotulo: "Publicado em", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
          { rotulo: "Gestor do instrumento", valor: c.gestorPrefeitura },
          { rotulo: "Conta bancária", valor: c.conta, largo: true },
        ],
      };
    case "extrato":
      if (c.instrumento === "convenio") {
        return {
          titulo: c.termo ? `Publicação do convênio nº ${c.termo}` : "Publicação do convênio",
          base: "IN TCE-MG 05/2025, art. 7º, VIII (publicidade do instrumento)",
          campos: [
            { rotulo: "Instrumento", valor: c.termo },
            { rotulo: "Valor do repasse", valor: brl(c.valor) },
            { rotulo: "Ente ou consórcio beneficiário", valor: c.beneficiario },
            { rotulo: "Vigência", valor: periodo(c.vigenciaInicio, c.vigenciaFim) },
            { rotulo: "Publicado em", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
          ],
        };
      }
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
    case "extrato_saneador":
      return {
        titulo: c.termo ? `Extrato saneador do termo nº ${c.termo}` : "Extrato saneador do termo de fomento",
        base: "Lei 13.019/2014, art. 38 (publicação do extrato) · orientação do Controle Interno",
        campos: [
          { rotulo: "Termo", valor: c.termo },
          { rotulo: "Valor do repasse", valor: brl(c.valor) },
          { rotulo: "Organização da sociedade civil", valor: c.beneficiario },
          { rotulo: "Extrato original publicado em", valor: c.extratoPublicadoEm ? dataBr(c.extratoPublicadoEm) : null },
          { rotulo: "Extrato saneador publicado em", valor: c.extratoSaneadorEm ? dataBr(c.extratoSaneadorEm) : null },
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
    case "nota_fiscal":
    case "prestacao_contas":
      return {
        titulo: doc.tipo === "nota_fiscal" ? "Nota fiscal com atesto de recebimento" : "Prestação de contas",
        base: "Comprovação do cumprimento da emenda (documento interno, não vai ao portal)",
        campos: [
          { rotulo: "Emenda", valor: autor },
          { rotulo: "Valor da emenda", valor: brl(c.valor) },
        ],
      };
  }
}

/**
 * Avisos que ficam ao lado de cada documento ligado: leitura que falhou, arquivo repetido, mais de um do mesmo tipo
 * e documento ligado sem o dado correspondente no cadastro. Puro: só olha o que já está carregado.
 */
export function avisosDoDocumento(
  doc: Pick<DocumentoDrive, "tipo" | "leitura_aviso" | "tambem_em">,
  mesmoTipo: number,
  execucao: { numero_termo?: string | null; data_publicacao_extrato?: string | null; data_extrato_saneador?: string | null } | null
): string[] {
  const a: string[] = [];
  if (doc.leitura_aviso) a.push(doc.leitura_aviso);
  if (mesmoTipo > 1 && doc.tipo !== "relatorio_gestao" && doc.tipo !== "jornal_edicao") a.push(`Há ${mesmoTipo} documentos deste tipo ligados a esta emenda: pode haver duplicidade.`);
  if (doc.tambem_em?.length) a.push(`O mesmo arquivo também está ligado à(s) emenda(s) nº ${doc.tambem_em.join(", ")}.`);
  if ((doc.tipo === "termo" || doc.tipo === "convenio") && !execucao?.numero_termo) a.push("Documento ligado, mas o nº do termo não está no cadastro.");
  if (doc.tipo === "extrato" && !execucao?.data_publicacao_extrato) a.push("Extrato ligado, mas a data de publicação não está no cadastro.");
  if (doc.tipo === "extrato_saneador" && !execucao?.data_extrato_saneador) a.push("Extrato saneador ligado, mas a data de publicação não está no cadastro (Parceria › Publicação do extrato saneador).");
  return a;
}
