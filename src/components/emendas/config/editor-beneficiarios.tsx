"use client";

import * as React from "react";
import { FileUp, Pencil, Plus } from "lucide-react";

import { CategoriaSelo } from "@/components/emendas/categoria-selo";
import { BOTAO, CAMPO, Erro, Secao, useSalvar } from "@/components/emendas/config/editores";
import { salvarBeneficiario } from "@/lib/emendas/actions-config";
import { lerDocumentoBeneficiario } from "@/lib/emendas/actions-beneficiario";
import { CATEGORIAS, INFO_CATEGORIA, ehCategoria, sugestaoDaCategoria, tipoDaCategoria, type CategoriaBeneficiario } from "@/lib/emendas/categorias";
import { TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import { ROTULO_INSTRUMENTO } from "@/lib/emendas/documentos-drive";
import { cn } from "@/lib/utils";
import type { Beneficiario } from "@/types/emendas";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mascararCpf = (c: string) => `***.${c.slice(4, 7)}.***-**`;

export function EditorBeneficiarios({ beneficiarios, usos }: { beneficiarios: Beneficiario[]; usos: Record<string, number> }) {
  const [busca, setBusca] = React.useState("");
  const [filtro, setFiltro] = React.useState<"" | CategoriaBeneficiario>("");
  const [editando, setEditando] = React.useState<string | "novo" | null>(null);
  const q = semAcento(busca);
  const lista = beneficiarios.filter(
    (b) => (!filtro || b.categoria === filtro) && (!q || semAcento(b.nome).includes(q) || (b.cnpj ?? b.cpf ?? "").includes(busca))
  );
  const porCategoria = new Map<string, number>();
  for (const b of beneficiarios) porCategoria.set(b.categoria, (porCategoria.get(b.categoria) ?? 0) + 1);

  return (
    <Secao
      titulo="Beneficiários"
      apoio="Quem recebe as emendas. A categoria (origem) sugere o tipo de execução e o instrumento da emenda, e aparece nas listas, nos filtros e no portal. CNPJ (entidade e consórcio) ou CPF (pessoa física) é obrigatório; o CPF nunca aparece no portal público."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="search" className={cn(CAMPO, "max-w-xs")} placeholder="Buscar por nome ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar beneficiário" />
        <select className={cn(CAMPO, "w-auto")} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias ({beneficiarios.length})</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {INFO_CATEGORIA[c].nome} ({porCategoria.get(c) ?? 0})
            </option>
          ))}
        </select>
        <button type="button" className={cn(BOTAO, "ml-auto")} onClick={() => setEditando("novo")} disabled={editando === "novo"}>
          <Plus className="h-4 w-4" aria-hidden /> Novo beneficiário
        </button>
      </div>
      {editando === "novo" && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <FormBeneficiario beneficiario={null} aoFechar={() => setEditando(null)} />
        </div>
      )}
      <ul className="flex flex-col divide-y divide-slate-100">
        {lista.map((b) =>
          editando === b.id ? (
            <li key={b.id} className="py-2.5">
              <FormBeneficiario beneficiario={b} aoFechar={() => setEditando(null)} />
            </li>
          ) : (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
              <span className="min-w-[200px] flex-1 font-medium text-cataguases-marinho">{b.nome}</span>
              <CategoriaSelo categoria={b.categoria} />
              <span className={cn("font-mono text-xs", b.cnpj || b.cpf ? "text-slate-600" : "text-amber-800")}>{b.cnpj ?? (b.cpf ? mascararCpf(b.cpf) : b.tipo === "pessoa_fisica" ? "sem CPF" : "sem CNPJ")}</span>
              <span className="w-24 text-right text-xs text-slate-500">{usos[b.id] ?? 0} emenda(s)</span>
              <button type="button" aria-label={`Editar ${b.nome}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditando(b.id)}>
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          )
        )}
      </ul>
      {lista.length === 0 && <p className="text-sm text-slate-500">Nenhum beneficiário encontrado.</p>}
    </Secao>
  );
}

function FormBeneficiario({ beneficiario, aoFechar }: { beneficiario: Beneficiario | null; aoFechar: () => void }) {
  const [nome, setNome] = React.useState(beneficiario?.nome ?? "");
  const [documento, setDocumento] = React.useState(beneficiario?.cnpj ?? beneficiario?.cpf ?? "");
  const [categoria, setCategoria] = React.useState<CategoriaBeneficiario>(beneficiario?.categoria ?? "osc");
  const [endereco, setEndereco] = React.useState(beneficiario?.endereco ?? "");
  const [email, setEmail] = React.useState(beneficiario?.email ?? "");
  const [telefone, setTelefone] = React.useState(beneficiario?.telefone ?? "");
  const [representante, setRepresentante] = React.useState(beneficiario?.representante ?? "");
  const [avisos, setAvisos] = React.useState<string[]>([]);
  const [lendo, setLendo] = React.useState(false);
  const [erroLeitura, setErroLeitura] = React.useState<string | null>(null);
  const [preenchidos, setPreenchidos] = React.useState<string[]>([]);
  const { erro, salvando, salvar } = useSalvar();
  const tipo = tipoDaCategoria(categoria);
  const sug = sugestaoDaCategoria(categoria);

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setLendo(true);
    setErroLeitura(null);
    setAvisos([]);
    setPreenchidos([]);
    const form = new FormData();
    form.set("arquivo", arquivo);
    const r = await lerDocumentoBeneficiario(form);
    setLendo(false);
    if (!r.sucesso) return setErroLeitura(r.erro);
    if (r.semTexto) return setErroLeitura("PDF sem texto (provavelmente digitalizado): preencha os dados à mão. A leitura por OCR ainda não está disponível.");
    // Preenche só o que foi achado, sem apagar o que a pessoa já digitou em campo que o documento não trouxe.
    const d = r.dados;
    const novos: string[] = [];
    if (d.nome) {
      setNome(d.nome);
      novos.push("nome");
    }
    if (d.cnpj) {
      setDocumento(d.cnpj);
      novos.push("CNPJ");
    }
    if (d.endereco) {
      setEndereco(d.endereco);
      novos.push("endereço");
    }
    if (d.email) {
      setEmail(d.email);
      novos.push("e-mail");
    }
    if (d.telefone) {
      setTelefone(d.telefone);
      novos.push("telefone");
    }
    if (d.representante) {
      setRepresentante(d.representante);
      novos.push("representante");
    }
    if (d.categoria && ehCategoria(d.categoria)) {
      setCategoria(d.categoria);
      novos.push(`categoria (${d.categoriaMotivo ?? "pelo documento"})`);
    }
    setPreenchidos(novos);
    setAvisos(r.avisos);
  }

  const rotulo = "flex flex-col gap-1 text-[13px] font-medium text-cataguases-marinho";
  return (
    <div className="flex flex-col gap-3">
      {!beneficiario && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2">
          <label className={cn(BOTAO, "cursor-pointer", lendo && "pointer-events-none opacity-50")}>
            <FileUp className="h-4 w-4" aria-hidden /> {lendo ? "Lendo…" : "Importar de um documento (PDF)"}
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={importar} disabled={lendo} />
          </label>
          <p className="min-w-[220px] flex-1 text-xs text-slate-600">
            Cartão do CNPJ, estatuto ou plano de trabalho. A plataforma só lê os dados para preencher o formulário: o arquivo não é guardado. Confira antes de salvar.
          </p>
        </div>
      )}
      {preenchidos.length > 0 && <p className="text-xs text-emerald-800" role="status">Preenchido pelo documento: {preenchidos.join(", ")}. Confira os campos.</p>}
      {avisos.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-900" role="status">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <Erro texto={erroLeitura} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={cn(rotulo, "sm:col-span-2")}>
          Nome
          <input className={CAMPO} maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className={rotulo}>
          Categoria (origem)
          <select className={CAMPO} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaBeneficiario)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {INFO_CATEGORIA[c].nome}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-slate-600">
            {INFO_CATEGORIA[categoria].descricao}{" "}
            {sug.tipoExecucao && (
              <>
                Sugere: execução “{TIPOS_EXECUCAO[sug.tipoExecucao].nome}”{sug.instrumento ? `, ${ROTULO_INSTRUMENTO[sug.instrumento].toLowerCase()}` : ""}.
              </>
            )}
          </span>
        </label>
        <label className={rotulo}>
          {tipo === "pessoa_fisica" ? "CPF" : tipo === "orgao_publico" ? "CNPJ (opcional)" : "CNPJ"}
          <input className={CAMPO} placeholder={tipo === "pessoa_fisica" ? "000.000.000-00" : "00.000.000/0000-00"} value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </label>
        <label className={cn(rotulo, "sm:col-span-2")}>
          Endereço <span className="font-normal text-slate-500">(uso interno)</span>
          <input className={CAMPO} maxLength={300} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </label>
        <label className={rotulo}>
          E-mail <span className="font-normal text-slate-500">(uso interno)</span>
          <input type="email" className={CAMPO} maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={rotulo}>
          Telefone <span className="font-normal text-slate-500">(uso interno)</span>
          <input className={CAMPO} maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </label>
        <label className={cn(rotulo, "sm:col-span-2")}>
          Representante legal <span className="font-normal text-slate-500">(uso interno, só o nome)</span>
          <input className={CAMPO} maxLength={120} value={representante} onChange={(e) => setRepresentante(e.target.value)} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={salvando}
          className={BOTAO}
          onClick={() =>
            void salvar(() => salvarBeneficiario({ id: beneficiario?.id, nome, documento, categoria, endereco, email, telefone, representante }), aoFechar)
          }
        >
          {beneficiario ? "Salvar" : "Cadastrar"}
        </button>
        <button type="button" className="text-sm text-slate-600 hover:underline" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <Erro texto={erro} />
    </div>
  );
}
