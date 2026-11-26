import { TIPOS_EXECUCAO, tipoDaEmenda } from "@/lib/emendas/fases";
import { NextResponse, type NextRequest } from "next/server";

import { listarConciliacoes, listarEncerramentos, listarExecucoes, listarMovimentos, obterContextoEmendas, resolverExercicio } from "@/lib/emendas/dados";
import { colunasDoArquivo } from "@/lib/emendas/colunas-lista";
import { linhasPanorama, rotuloSituacao, type LinhaPanorama } from "@/lib/emendas/encerramento";
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

  // Saldos da execução (sem empenhar, empenho não pago, acima da emenda) e situação de encerramento/conciliação: a mesma regra do Panorama.
  const idsDaLista = emendas.map((e) => e.id);
  const [encerramentos, conciliacoes] = await Promise.all([listarEncerramentos(idsDaLista), listarConciliacoes(idsDaLista)]);
  const panorama = new Map<string, LinhaPanorama>(
    linhasPanorama(
      emendas.map((e) => ({
        id: e.id,
        numero: e.numero,
        objeto: e.objeto,
        vereador_nome: e.vereador_nome,
        secretaria_id: e.secretaria_id,
        secretaria_nome: e.secretaria_nome,
        beneficiario_nome: e.beneficiario_nome,
        tipo_execucao: tipoDaEmenda(e),
        valor: e.valor,
        empenhado: e.empenhado,
        pago: e.pago,
        etapa: e.etapa,
        situacao: e.situacao,
      })),
      encerramentos,
      conciliacoes
    ).map((l) => [l.id, l])
  );
  const conciliacao = new Map(conciliacoes.map((c) => [c.id, c]));
  const situacaoTexto = (e: (typeof emendas)[number]): string => {
    const l = panorama.get(e.id);
    if (!l) return "";
    const partes: string[] = [l.encerramento ? rotuloSituacao(l.encerramento, l.tipo_execucao) : "Sem situação definida"];
    const c = conciliacao.get(e.id);
    if (c?.saldo_registrado_em) partes.push("saldo registrado");
    if (c?.anulacao_solicitada_em) partes.push("anulação solicitada");
    if (l.semFonte) partes.push("acima da emenda sem fonte");
    return partes.join("; ");
  };
  const semEmpenhar = (e: (typeof emendas)[number]) => panorama.get(e.id)?.semEmpenhar ?? Math.max(0, Math.round((e.valor - e.empenhado) * 100) / 100);
  const naoPago = (e: (typeof emendas)[number]) => panorama.get(e.id)?.aPagar ?? Math.max(0, Math.round((e.empenhado - e.pago) * 100) / 100);
  const acima = (e: (typeof emendas)[number]) => panorama.get(e.id)?.excesso ?? 0;

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
  // Valor de cada coluna do catálogo (PDF e Excel leem daqui). Datas: Date no Excel, texto dd/mm/aaaa no PDF.
  const dataIso = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00`) : null);
  const [movimentos, execucoes] = await Promise.all([listarMovimentos(idsDaLista), listarExecucoes(idsDaLista)]);
  const execucao = new Map(execucoes.map((x) => [x.id, x]));
  const empenhos = new Map<string, string[]>();
  for (const m of movimentos) {
    if (m.tipo === "empenho" && m.numero) empenhos.set(m.emenda_id, [...(empenhos.get(m.emenda_id) ?? []), m.numero]);
  }
  const valores = (e: (typeof emendas)[number]): Record<string, string | number | Date | null> => {
    const x = execucao.get(e.id);
    const c = conciliacao.get(e.id);
    return {
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
      semEmpenhar: semEmpenhar(e),
      naoPago: naoPago(e),
      acima: acima(e),
      situacaoExec: situacaoTexto(e),
      saldoRegistrado: dataIso(c?.saldo_registrado_em),
      anulacaoEm: dataIso(c?.anulacao_solicitada_em),
      excessoFonte: c?.excesso_fonte ?? "",
      dataPagamento: dataIso(e.ultimo_pagamento),
      remanejada: e.remanejada ? "Sim" : "",
      termo: x?.numero_termo ?? "",
      processo: x?.processo_licitatorio ?? "",
      vigenciaInicio: dataIso(x?.vigencia_inicio),
      vigenciaFim: dataIso(x?.vigencia_fim),
      extrato: dataIso(x?.data_publicacao_extrato),
      conta: x?.conta_bancaria ?? "",
      gestorOsc: x?.gestor_osc ?? "",
      gestorPmc: x?.gestor_pmc ?? "",
    };
  };

  if (p.get("formato") === "pdf") {
    const soma = (f: (e: (typeof emendas)[number]) => number) => emendas.reduce((t, e) => t + f(e), 0);
    const cols = colunasDoArquivo(p.get("cols"), "pdf");
    const texto = (v: string | number | Date | null) => (v instanceof Date ? v.toLocaleDateString("pt-BR") : (v ?? ""));
    const somas: Record<string, number> = { valor: soma((e) => e.valor), empenhado: soma((e) => e.empenhado), pago: soma((e) => e.pago), semEmpenhar: soma(semEmpenhar), naoPago: soma(naoPago), acima: soma(acima) };
    const primeiraTexto = cols.findIndex((c) => c.tipo !== "dinheiro");
    const pdf = montarPdfTabelas({
      titulo: `Emendas impositivas - ${exercicio.ano}`,
      subtitulo: `${contagem}. ${filtros.length ? `Filtros: ${filtros.join("; ")}.` : "Sem filtros."} Gerado com as permissões de quem exportou.`,
      tabelas: [
        {
          titulo: "Emendas",
          colunas: cols.map((c) => c.rotulo),
          monetarias: cols.flatMap((c, i) => (c.tipo === "dinheiro" ? [i] : [])),
          linhas: emendas.map((e) => {
            const v = valores(e);
            return cols.map((c) => (c.tipo === "dinheiro" ? (v[c.chave] as number) : String(texto(v[c.chave]))));
          }),
          total: cols.map((c, i) => (c.chave in somas ? somas[c.chave] : i === Math.max(0, primeiraTexto) && !(c.chave in somas) ? "Total" : "")),
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
  const colsX = colunasDoArquivo(p.get("cols"), "xlsx");
  ws.columns = colsX.map((c) => ({ header: c.rotulo, key: c.chave, width: c.largura }));
  for (const e of emendas) ws.addRow(valores(e));
  const ultima = emendas.length + 1;
  // Letras das colunas vêm das chaves: inserir uma coluna não desalinha mais os totais.
  const col = (k: string) => ws.getColumn(k).letter;
  const linhaTotal: Record<string, string | { formula: string }> = {};
  const somaveis = ["valor", "empenhado", "pago", "semEmpenhar", "naoPago", "acima"].filter((k) => colsX.some((c) => c.chave === k));
  for (const k of somaveis) linhaTotal[k] = { formula: `SUM(${col(k)}2:${col(k)}${ultima})` };
  const rotuloTotal = colsX.find((c) => c.tipo !== "dinheiro" && !(c.chave in linhaTotal));
  if (rotuloTotal) linhaTotal[rotuloTotal.chave] = "Total";
  const total = ws.addRow(linhaTotal);
  total.font = { bold: true };

  const cabecalho = ws.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0C1D33" } };
  cabecalho.alignment = { vertical: "middle" };
  cabecalho.height = 22;
  for (const k of somaveis) ws.getColumn(k).numFmt = '"R$" #,##0.00';
  for (const c of colsX.filter((c) => c.tipo === "data")) ws.getColumn(c.chave).numFmt = "dd/mm/yyyy";
  for (const k of ["descricao", "objeto"].filter((k) => colsX.some((c) => c.chave === k))) ws.getColumn(k).alignment = { wrapText: true, vertical: "top" };
  ws.autoFilter = { from: "A1", to: `${ws.getColumn(ws.columnCount).letter}1` };

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="emendas-${exercicio.ano}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
