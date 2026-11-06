"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/imoveis/ui";
import { aplicarDocumento, lerDocumentoPdf, type OpcaoUnidadeDoc } from "@/lib/imoveis/actions-documento-pdf";
import type { DocumentoLido, TipoDocumentoLido } from "@/lib/imoveis/pdf-documento";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

const ROTULOS: Record<TipoDocumentoLido, string> = { contrato: "Contrato de locação", titularidade: "Comprovante de troca de titularidade", vistoria: "Laudo de vistoria" };

type Campo = { chave: string; rotulo: string; valor: string; tipo: "text" | "date" | "number" | "textarea" | "indice"; marcado: boolean };

function camposDe(d: DocumentoLido): Campo[] {
  if (d.tipo === "contrato") {
    const x = d.dados;
    const c = (chave: string, rotulo: string, valor: string | undefined, tipo: Campo["tipo"]): Campo => ({ chave, rotulo, valor: valor ?? "", tipo, marcado: valor !== undefined });
    return [
      c("contratoNumero", "Número do contrato", x.contratoNumero, "text"),
      c("vigenciaInicio", "Início da vigência", x.vigenciaInicio, "date"),
      c("vigenciaFim", "Fim da vigência", x.vigenciaFim, "date"),
      c("valorAluguel", "Aluguel mensal (R$)", x.valorAluguel !== undefined ? valorParaCampo(x.valorAluguel) : undefined, "text"),
      c("diaVencimento", "Dia do vencimento", x.diaVencimento !== undefined ? String(x.diaVencimento) : undefined, "number"),
      c("indiceReajuste", "Índice de reajuste", x.indiceReajuste, "indice"),
      c("proprietarioNome", "Proprietário (locador)", x.proprietarioNome, "text"),
      c("proprietarioDocumento", "CPF ou CNPJ do proprietário", x.proprietarioDocumento, "text"),
    ];
  }
  if (d.tipo === "titularidade") {
    return [
      { chave: "unidadeTipo", rotulo: "Troca de titularidade da", valor: d.dados.tipo ?? "", tipo: "indice", marcado: true },
      { chave: "dataTroca", rotulo: "Data da troca", valor: d.dados.dataTroca ?? "", tipo: "date", marcado: !!d.dados.dataTroca },
    ];
  }
  return [
    { chave: "dataVistoria", rotulo: "Vistoria concluída em", valor: d.dados.dataVistoria ?? "", tipo: "date", marcado: !!d.dados.dataVistoria },
    { chave: "vistoriador", rotulo: "Vistoriador", valor: d.dados.vistoriador ?? "", tipo: "text", marcado: !!d.dados.vistoriador },
    { chave: "resumo", rotulo: "Resultado da vistoria", valor: d.dados.resumo ?? "", tipo: "textarea", marcado: !!d.dados.resumo },
  ];
}

/** Lê um PDF do imóvel (contrato, titularidade, vistoria), propõe os dados e aplica o que for confirmado. O PDF nunca é guardado. */
export function LeitorDocumento({ imovelId, tipoInicial = "contrato" }: { imovelId: string; tipoInicial?: TipoDocumentoLido }) {
  const router = useRouter();
  const [tipo, setTipo] = React.useState<TipoDocumentoLido>(tipoInicial);
  const [campos, setCampos] = React.useState<Campo[] | null>(null);
  const [documento, setDocumento] = React.useState<DocumentoLido | null>(null);
  const [unidades, setUnidades] = React.useState<OpcaoUnidadeDoc[]>([]);
  const [avisos, setAvisos] = React.useState<string[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();

  function ler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setCampos(null);
    const form = new FormData(e.currentTarget);
    form.set("imovelId", imovelId);
    form.set("tipo", tipo);
    iniciar(async () => {
      const r = await lerDocumentoPdf(form);
      if (!r.sucesso) return setErro(r.erro);
      setUnidades(r.unidades);
      if (r.semTexto) return setErro("PDF sem texto (provavelmente digitalizado): preencha os dados à mão. A leitura por OCR ainda não está disponível.");
      setDocumento(r.documento);
      setAvisos(r.documento.avisos);
      setCampos(camposDe(r.documento));
    });
  }

  const mudar = (chave: string, parte: Partial<Campo>) => setCampos((cs) => cs?.map((c) => (c.chave === chave ? { ...c, ...parte } : c)) ?? null);
  const valorDe = (chave: string) => campos?.find((c) => c.chave === chave)?.valor ?? "";

  function aplicar() {
    if (!campos || !documento) return;
    setErro(null);
    const marcados = campos.filter((c) => c.marcado && c.valor !== "");
    if (marcados.length === 0) return setErro("Marque ao menos um campo para aplicar.");
    let entrada: Parameters<typeof aplicarDocumento>[0];
    if (documento.tipo === "contrato") {
      const campos2: Record<string, string | number> = {};
      for (const c of marcados) {
        if (c.chave === "valorAluguel") {
          const n = lerValor(c.valor);
          if (n === null || Number.isNaN(n)) return setErro("O valor do aluguel está inválido.");
          campos2[c.chave] = n;
        } else if (c.chave === "diaVencimento") campos2[c.chave] = Number(c.valor);
        else campos2[c.chave] = c.valor;
      }
      entrada = { tipo: "contrato", imovelId, campos: campos2 as never };
    } else if (documento.tipo === "titularidade") {
      const t = valorDe("unidadeTipo");
      if (t !== "agua" && t !== "luz") return setErro("Escolha se é água ou luz.");
      entrada = { tipo: "titularidade", imovelId, unidadeTipo: t, dataTroca: valorDe("dataTroca") };
    } else {
      entrada = { tipo: "vistoria", imovelId, dataVistoria: valorDe("dataVistoria"), vistoriador: valorDe("vistoriador") || undefined, resumo: valorDe("resumo") || undefined };
    }
    iniciar(async () => {
      const r = await aplicarDocumento(entrada);
      if (!r.sucesso) return setErro(r.erro);
      setOk(true);
      setCampos(null);
      setDocumento(null);
      router.refresh();
    });
  }

  const campo = ESTILO_CAMPO_PADRAO;
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={ler} className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Tipo de documento" htmlFor="ld-tipo">
          <select id="ld-tipo" className={campo} value={tipo} onChange={(e) => { setTipo(e.target.value as TipoDocumentoLido); setCampos(null); }}>
            {(Object.keys(ROTULOS) as TipoDocumentoLido[]).map((k) => <option key={k} value={k}>{ROTULOS[k]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="PDF" htmlFor="ld-arq"><input id="ld-arq" name="arquivo" type="file" accept="application/pdf" required className="text-sm" /></Campo>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente && !campos ? "Lendo…" : "Ler documento"}</button>
      </form>
      <p className="text-xs text-slate-500">O sistema lê o texto do PDF e propõe os dados. Você confere antes de aplicar, e o arquivo <b>não é guardado</b>: só os dados confirmados entram no cadastro.</p>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {ok && <Mensagem tipo="ok">Dados aplicados ao imóvel.</Mensagem>}

      {campos && documento && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:p-4">
          <p className="text-sm font-semibold text-cataguases-marinho">Confira o que foi lido</p>
          {avisos.map((a) => <p key={a} className="text-xs text-amber-800">⚠ {a}</p>)}
          {documento.tipo === "titularidade" && <p className="text-xs text-slate-600">Aplicar registra a troca na etapa de titularidade da entrega do imóvel{unidades.length ? ` (unidades: ${unidades.map((u) => u.rotulo).join(", ")})` : ""}.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <div key={c.chave} className={`flex items-start gap-2 ${c.tipo === "textarea" ? "sm:col-span-2" : ""}`}>
                <input aria-label={`Aplicar ${c.rotulo}`} type="checkbox" className="mt-8" checked={c.marcado} onChange={(e) => mudar(c.chave, { marcado: e.target.checked })} />
                <Campo rotulo={c.rotulo} htmlFor={`ld-${c.chave}`} className="flex-1">
                  {c.tipo === "textarea" ? (
                    <textarea id={`ld-${c.chave}`} rows={3} className={campo} value={c.valor} onChange={(e) => mudar(c.chave, { valor: e.target.value, marcado: e.target.value !== "" })} />
                  ) : c.tipo === "indice" ? (
                    <select id={`ld-${c.chave}`} className={campo} value={c.valor} onChange={(e) => mudar(c.chave, { valor: e.target.value, marcado: e.target.value !== "" })}>
                      <option value="">—</option>
                      {c.chave === "unidadeTipo" ? <><option value="agua">Água</option><option value="luz">Luz</option></> : ["IPCA", "IGP-M", "INPC", "outro"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input id={`ld-${c.chave}`} type={c.tipo} className={campo} value={c.valor} onChange={(e) => mudar(c.chave, { valor: e.target.value, marcado: e.target.value !== "" })} />
                  )}
                </Campo>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pendente} className={CLASSE_BOTAO} onClick={aplicar}>{pendente ? "Aplicando…" : "Aplicar os campos marcados"}</button>
            <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={() => { setCampos(null); setDocumento(null); }}>Descartar</button>
          </div>
        </div>
      )}
    </div>
  );
}
