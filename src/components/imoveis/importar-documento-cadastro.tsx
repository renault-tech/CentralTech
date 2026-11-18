"use client";

import * as React from "react";

import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/imoveis/ui";
import { lerDocumentoParaCadastro, type PropostaCadastro } from "@/lib/imoveis/actions-documento-pdf";
import { valorParaCampo } from "@/lib/frotas/entrada";

/** Campos do formulário (mesmas chaves do estado do `FormularioImovel`) que a leitura de um contrato pode propor. */
export type ValoresCadastro = Partial<Record<"nome" | "endereco" | "secretariaId" | "finalidade" | "vinculo" | "contratoNumero" | "vigenciaInicio" | "vigenciaFim" | "valorAluguel" | "diaVencimento" | "indiceReajuste" | "proximoReajuste" | "imobiliariaId" | "proprietarioNome" | "proprietarioDocumento" | "proprietarioContato" | "proprietarioConta", string>>;

type Linha = { chave: keyof ValoresCadastro; rotulo: string; valor: string; mostrar: string; atual: string; marcado: boolean };

const ROTULOS: [keyof ValoresCadastro, string][] = [
  ["endereco", "Endereço"], ["secretariaId", "Secretaria"], ["finalidade", "Finalidade"], ["vinculo", "Vínculo"], ["contratoNumero", "Número do contrato"],
  ["vigenciaInicio", "Início da vigência"], ["vigenciaFim", "Fim da vigência"], ["valorAluguel", "Aluguel mensal (R$)"], ["diaVencimento", "Dia do vencimento"],
  ["indiceReajuste", "Índice de reajuste"], ["proximoReajuste", "Próximo reajuste"], ["imobiliariaId", "Imobiliária"], ["proprietarioNome", "Proprietário"],
  ["proprietarioDocumento", "CPF ou CNPJ do proprietário"], ["proprietarioContato", "Contato"], ["proprietarioConta", "Conta para pagamento"],
];

function valoresDaProposta(p: PropostaCadastro): { valores: ValoresCadastro; mostrar: ValoresCadastro } {
  const valores: ValoresCadastro = {};
  const mostrar: ValoresCadastro = {};
  const pôr = (k: keyof ValoresCadastro, v: string | undefined, exibir?: string) => {
    if (v === undefined || v === "") return;
    valores[k] = v;
    mostrar[k] = exibir ?? v;
  };
  pôr("endereco", p.endereco);
  pôr("secretariaId", p.secretariaId, p.secretariaRotulo);
  pôr("finalidade", p.finalidade);
  pôr("vinculo", "alugado", "Alugado (há contrato de locação)");
  pôr("contratoNumero", p.contratoNumero);
  pôr("vigenciaInicio", p.vigenciaInicio);
  pôr("vigenciaFim", p.vigenciaFim);
  if (p.valorAluguel !== undefined) pôr("valorAluguel", valorParaCampo(p.valorAluguel));
  if (p.diaVencimento !== undefined) pôr("diaVencimento", String(p.diaVencimento));
  pôr("indiceReajuste", p.indiceReajuste);
  pôr("proximoReajuste", p.proximoReajuste);
  pôr("imobiliariaId", p.imobiliariaId, p.imobiliariaRotulo);
  pôr("proprietarioNome", p.proprietarioNome);
  pôr("proprietarioDocumento", p.proprietarioDocumento);
  pôr("proprietarioContato", p.proprietarioContato);
  pôr("proprietarioConta", p.proprietarioConta);
  return { valores, mostrar };
}

const vazio = (k: keyof ValoresCadastro, s: string) => s === "" || (k === "valorAluguel" && /^0([.,]0+)?$/.test(s));

/**
 * Preenche o formulário de cadastro a partir de um documento (contrato em PDF, Word ou texto). Só extrai o TEXTO: o arquivo não é
 * guardado. A pessoa confere cada campo; o que o formulário já tem preenchido com outro valor começa desmarcado. Nada é gravado aqui:
 * quem grava é o botão "Cadastrar/Salvar" do formulário.
 */
export function ImportarDocumentoCadastro({ atual, rotuloAtual, aoPreencher }: { atual: ValoresCadastro; rotuloAtual: (k: keyof ValoresCadastro, v: string) => string; aoPreencher: (v: ValoresCadastro) => void }) {
  const [linhas, setLinhas] = React.useState<Linha[] | null>(null);
  const [avisos, setAvisos] = React.useState<string[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const entrada = React.useRef<HTMLInputElement>(null);

  function ler(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    setLinhas(null);
    const arquivo = entrada.current?.files?.[0];
    if (!arquivo) return setErro("Escolha um arquivo.");
    const form = new FormData();
    form.set("arquivo", arquivo);
    iniciar(async () => {
      const r = await lerDocumentoParaCadastro(form);
      if (!r.sucesso) return setErro(r.erro);
      if ("semTexto" in r) return setErro("Arquivo sem texto (provavelmente digitalizado): preencha os dados à mão. A leitura por OCR ainda não está disponível.");
      const { valores, mostrar } = valoresDaProposta(r.proposta);
      const l: Linha[] = ROTULOS.filter(([k]) => valores[k] !== undefined).map(([k, rotulo]) => {
        const at = atual[k] ?? "";
        return { chave: k, rotulo, valor: valores[k] as string, mostrar: mostrar[k] as string, atual: at, marcado: vazio(k, at) || at === valores[k] };
      });
      setAvisos(r.avisos);
      if (l.length === 0) return setErro("Não encontrei dados do imóvel neste documento: preencha à mão.");
      setLinhas(l);
    });
  }

  function preencher() {
    if (!linhas) return;
    const marcados = linhas.filter((l) => l.marcado);
    if (marcados.length === 0) return setErro("Marque ao menos um campo.");
    aoPreencher(Object.fromEntries(marcados.map((l) => [l.chave, l.valor])) as ValoresCadastro);
    setOk(`${marcados.length} campo(s) preenchido(s). Confira o formulário e salve.`);
    setLinhas(null);
    setErro(null);
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <section className="rounded-lg border border-slate-200 p-3 sm:p-4" aria-label="Preencher a partir de um documento">
      <p className="text-sm font-semibold text-cataguases-marinho">Preencher a partir de um documento</p>
      <p className="mt-1 text-xs text-slate-500">
        Envie o contrato de locação (PDF, Word .docx ou texto). O sistema <b>só extrai o texto</b> para propor os campos: o arquivo <b>não é guardado</b>. Você confere e salva.
      </p>
      <form onSubmit={ler} className="mt-3 flex flex-wrap items-end gap-3">
        <input ref={entrada} type="file" aria-label="Documento do imóvel" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="text-sm" />
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>{pendente ? "Lendo…" : "Ler documento"}</button>
      </form>
      {erro && <div className="mt-3"><Mensagem tipo="erro">{erro}</Mensagem></div>}
      {ok && <div className="mt-3"><Mensagem tipo="ok">{ok}</Mensagem></div>}
      {linhas && (
        <div className="mt-3 flex flex-col gap-2">
          {avisos.map((a) => <p key={a} className="text-xs text-amber-800">⚠ {a}</p>)}
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {linhas.map((l, i) => (
              <li key={l.chave} className="flex items-start gap-2 p-2 text-sm">
                <input aria-label={`Preencher ${l.rotulo}`} type="checkbox" className="mt-1" checked={l.marcado} onChange={(e) => setLinhas((ls) => ls?.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)) ?? null)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">{l.rotulo}</p>
                  <p className="break-words font-medium text-cataguases-marinho">{l.mostrar}</p>
                  {!vazio(l.chave, l.atual) && l.atual !== l.valor && <p className="text-xs text-amber-800">No formulário agora: {rotuloAtual(l.chave, l.atual)} (será substituído se marcado)</p>}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={CLASSE_BOTAO} onClick={preencher}>Preencher o formulário</button>
            <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={() => setLinhas(null)}>Descartar</button>
          </div>
        </div>
      )}
    </section>
  );
}
