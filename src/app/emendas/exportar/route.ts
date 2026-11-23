import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { NextResponse, type NextRequest } from "next/server";

import { listarExecucoes, listarMovimentos, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { carregarListaParaExportar } from "@/lib/emendas/exportar-lista";
import { montarPdfExecutivo } from "@/lib/emendas/pdf-executivo";
import { relatorioDaLista } from "@/lib/emendas/relatorio-executivo";
import { montarPdfTabelas } from "@/lib/emendas/pdf";
import { NOME_MODALIDADE, infoEtapa } from "@/lib/emendas/regras";

export const dynamic = "force-dynamic";

/**
 * Planilha .xlsx das emendas, com os mesmos filtros da lista. Lida com a
 * sessão de quem pede (RLS): cada pessoa só exporta o que pode ver.
 * Colunas na mesma ordem da planilha de acompanhamento antiga, mais a
 * execução estruturada (empenho, pago, datas) e os dados de parceria da
 * planilha de cumprimento (termo, vigência, extrato, envio para pagamento).
 */
export async function GET(request: NextRequest) {
  const ctx = await obterContextoEmendas();
  if (ctx.situacao !== "ok") return NextResponse.redirect(new URL("/emendas", request.url));

  const p = request.nextUrl.searchParams;
  const { exercicio } = await resolverExercicio(p.get("ano"));
  if (!exercicio) return NextResponse.redirect(new URL("/emendas", request.url));

  // Filtros, busca e ordem: os MESMOS da tela (função compartilhada). O arquivo diz no cabeçalho o que filtrou e quantas emendas tem.
  const { emendas, catalogo, filtros, totalDoExercicio } = await carregarListaParaExportar(p, exercicio);
  const contagem = `${emendas.length} ${emendas.length === 1 ? "emenda" : "emendas"}${emendas.length !== totalDoExercicio ? ` (de ${totalDoExercicio} no exercício)` : ""}`;

  if (p.get("formato") === "executivo") {
    const pdf = montarPdfExecutivo(relatorioDaLista({ ano: exercicio.ano, emendas, catalogo, filtros, totalDoExercicio, comTabela: p.get("tabela") !== "0" }));
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="emendas-${exercicio.ano}-panorama.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (p.get("formato") === "pdf") {
    const soma = (f: (e: (typeof emendas)[number]) => number) => emendas.reduce((t, e) => t + f(e), 0);
    const pdf = montarPdfTabelas({
      titulo: `Emendas impositivas - ${exercicio.ano}`,
      subtitulo: `${contagem}. ${filtros.length ? `Filtros: ${filtros.join("; ")}.` : "Sem filtros."} Gerado com as permissões de quem exportou.`,
      tabelas: [
        {
          titulo: "Emendas",
          colunas: ["Nº", "Vereador", "Objeto", "Beneficiário", "Secretaria", "Tipo", "Etapa", "Valor", "Empenhado", "Pago"],
          monetarias: [7, 8, 9],
          linhas: emendas.map((e) => [
            e.numero,
            `${String(e.vereador_numero).padStart(2, "0")} - ${e.vereador_nome}`,
            e.objeto,
            e.beneficiario_nome ?? "",
            e.secretaria_nome,
            TIPOS_EXECUCAO[tipoDaEmenda(e)].curto,
            infoEtapa(e.etapa, catalogo).nome,
            e.valor,
            e.empenhado,
            e.pago,
          ]),
          total: ["", "", "", "", "", "", "Total", soma((e) => e.valor), soma((e) => e.empenhado), soma((e) => e.pago)],
        },
      ],
    });
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="emendas-${exercicio.ano}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const [movimentos, execucoes] = await Promise.all([listarMovimentos(emendas.map((e) => e.id)), listarExecucoes(emendas.map((e) => e.id))]);
  const execucao = new Map(execucoes.map((x) => [x.id, x]));
  const data = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00`) : null);
  const empenhos = new Map<string, string[]>();
  for (const m of movimentos) {
    if (m.tipo === "empenho" && m.numero) empenhos.set(m.emenda_id, [...(empenhos.get(m.emenda_id) ?? []), m.numero]);
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Central Cataguases · Emendas";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Emendas ${exercicio.ano}`, { views: [{ state: "frozen", ySplit: 1 }] });
  const wf = wb.addWorksheet("Filtros aplicados");
  wf.columns = [{ width: 28 }, { width: 80 }];
  wf.addRow(["Exercício", exercicio.ano]);
  wf.addRow(["Emendas neste arquivo", emendas.length]);
  wf.addRow(["Emendas do exercício", totalDoExercicio]);
  wf.addRow(["Filtros", filtros.length ? filtros.join("\n") : "Nenhum (todas as emendas visíveis para quem exportou)"]);
  wf.getRow(4).getCell(2).alignment = { wrapText: true, vertical: "top" };
  wf.getColumn(1).font = { bold: true };
  ws.columns = [
    { header: "Emenda", key: "numero", width: 9 },
    { header: "ID", key: "id", width: 6 },
    { header: "Vereador", key: "vereador", width: 34 },
    { header: "Objeto", key: "objeto", width: 50 },
    { header: "Descrição", key: "descricao", width: 60 },
    { header: "Valor", key: "valor", width: 15 },
    { header: "Destinação", key: "beneficiario", width: 32 },
    { header: "Funcional", key: "funcional", width: 18 },
    { header: "Natureza", key: "natureza", width: 11 },
    { header: "Nova dotação", key: "ficha", width: 40 },
    { header: "Unidade", key: "unidade", width: 30 },
    { header: "Secretaria", key: "secretaria", width: 24 },
    { header: "Saúde", key: "saude", width: 7 },
    { header: "Modalidade", key: "modalidade", width: 19 },
    { header: "Tipo de execução", key: "tipo", width: 20 },
    { header: "Etapa", key: "etapa", width: 20 },
    { header: "Situação", key: "situacao", width: 11 },
    { header: "Empenho(s)", key: "empenhos", width: 14 },
    { header: "Empenhado", key: "empenhado", width: 15 },
    { header: "Pago", key: "pago", width: 15 },
    { header: "Data do pagamento", key: "dataPagamento", width: 13 },
    { header: "Remanejada", key: "remanejada", width: 11 },
    { header: "Termo de parceria", key: "termo", width: 12 },
    { header: "Processo licitatório", key: "processo", width: 24 },
    { header: "Início da vigência", key: "vigenciaInicio", width: 13 },
    { header: "Fim da vigência", key: "vigenciaFim", width: 13 },
    { header: "Publicação do extrato", key: "extrato", width: 13 },
    { header: "Conta bancária", key: "conta", width: 34 },
    { header: "Gestor na entidade", key: "gestorOsc", width: 30 },
    { header: "Gestor na Prefeitura", key: "gestorPmc", width: 30 },
  ];
  for (const e of emendas) {
    const x = execucao.get(e.id);
    ws.addRow({
      numero: e.numero,
      id: e.numero_vereador,
      vereador: `${String(e.vereador_numero).padStart(2, "0")} - ${e.vereador_nome}`,
      objeto: e.objeto,
      descricao: e.descricao,
      valor: e.valor,
      beneficiario: e.beneficiario_nome ?? "",
      funcional: e.funcional_programatica ?? "",
      natureza: e.natureza_despesa ?? "",
      ficha: e.ficha ?? "",
      unidade: `${e.unidade_codigo} - ${e.unidade_nome}`,
      secretaria: e.secretaria_nome,
      saude: e.saude ? "Sim" : "Não",
      modalidade: NOME_MODALIDADE[e.modalidade],
      tipo: TIPOS_EXECUCAO[tipoDaEmenda(e)].nome,
      etapa: infoEtapa(e.etapa, catalogo).nome,
      situacao: e.situacao === "normal" ? "" : e.situacao === "impedida" ? "Impedida" : "Cancelada",
      empenhos: (empenhos.get(e.id) ?? []).join(", "),
      empenhado: e.empenhado,
      pago: e.pago,
      dataPagamento: data(e.ultimo_pagamento),
      remanejada: e.remanejada ? "Sim" : "",
      termo: x?.numero_termo ?? "",
      processo: x?.processo_licitatorio ?? "",
      vigenciaInicio: data(x?.vigencia_inicio),
      vigenciaFim: data(x?.vigencia_fim),
      extrato: data(x?.data_publicacao_extrato),
      conta: x?.conta_bancaria ?? "",
      gestorOsc: x?.gestor_osc ?? "",
      gestorPmc: x?.gestor_pmc ?? "",
    });
  }
  const ultima = emendas.length + 1;
  // Letras das colunas vêm das chaves: inserir uma coluna não desalinha mais os totais.
  const col = (k: string) => ws.getColumn(k).letter;
  const total = ws.addRow({ vereador: "Total", valor: { formula: `SUM(${col("valor")}2:${col("valor")}${ultima})` }, empenhado: { formula: `SUM(${col("empenhado")}2:${col("empenhado")}${ultima})` }, pago: { formula: `SUM(${col("pago")}2:${col("pago")}${ultima})` } });
  total.font = { bold: true };

  const cabecalho = ws.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1D33" } };
  cabecalho.alignment = { vertical: "middle" };
  cabecalho.height = 22;
  for (const k of ["valor", "empenhado", "pago"]) ws.getColumn(k).numFmt = '"R$" #,##0.00';
  for (const k of ["dataPagamento", "vigenciaInicio", "vigenciaFim", "extrato", "envio"]) ws.getColumn(k).numFmt = "dd/mm/yyyy";
  for (const k of ["descricao", "objeto"]) ws.getColumn(k).alignment = { wrapText: true, vertical: "top" };
  ws.autoFilter = { from: "A1", to: "AD1" };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="emendas-${exercicio.ano}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
