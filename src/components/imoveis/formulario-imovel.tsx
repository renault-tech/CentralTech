"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CampoEndereco } from "@/components/modulo/campo-endereco";
import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_PERIGO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/imoveis/ui";
import { excluirImovel, salvarImovel } from "@/lib/imoveis/actions";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import type { Imobiliaria, Imovel, SecretariaImoveis } from "@/types/imoveis";

/** Cadastro e edição de um imóvel: dados, contrato, imobiliária e proprietário. */
export function FormularioImovel({ imovel, secretarias, imobiliarias, voltarPara }: { imovel: Imovel | null; secretarias: SecretariaImoveis[]; imobiliarias: Imobiliaria[]; voltarPara: string }) {
  const router = useRouter();
  const [v, setV] = React.useState({
    nome: imovel?.nome ?? "",
    endereco: imovel?.endereco ?? "",
    secretariaId: imovel?.secretaria_id ?? "",
    setor: imovel?.setor ?? "",
    finalidade: imovel?.finalidade ?? "",
    vinculo: imovel?.vinculo ?? "alugado",
    contratoNumero: imovel?.contrato_numero ?? "",
    vigenciaInicio: imovel?.vigencia_inicio ?? "",
    vigenciaFim: imovel?.vigencia_fim ?? "",
    valorAluguel: valorParaCampo(imovel?.valor_aluguel ?? 0),
    diaVencimento: imovel?.dia_vencimento ? String(imovel.dia_vencimento) : "",
    indiceReajuste: imovel?.indice_reajuste ?? "",
    proximoReajuste: imovel?.proximo_reajuste ?? "",
    imobiliariaId: imovel?.imobiliaria_id ?? "",
    proprietarioNome: imovel?.proprietario_nome ?? "",
    proprietarioDocumento: imovel?.proprietario_documento ?? "",
    proprietarioContato: imovel?.proprietario_contato ?? "",
    proprietarioConta: imovel?.proprietario_conta ?? "",
    observacoes: imovel?.observacoes ?? "",
  });
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const aluguel = lerValor(v.valorAluguel);
    if (aluguel === null || Number.isNaN(aluguel)) return setErro("Informe o valor do aluguel (ex.: 4.800,00).");
    iniciar(async () => {
      const r = await salvarImovel({
        id: imovel?.id,
        nome: v.nome,
        endereco: v.endereco,
        secretariaId: v.secretariaId,
        setor: v.setor,
        finalidade: v.finalidade,
        vinculo: v.vinculo as "alugado" | "proprio" | "cedido",
        contratoNumero: v.contratoNumero,
        vigenciaInicio: v.vigenciaInicio || null,
        vigenciaFim: v.vigenciaFim || null,
        valorAluguel: aluguel,
        diaVencimento: v.diaVencimento ? Number(v.diaVencimento) : null,
        indiceReajuste: (v.indiceReajuste || null) as "IPCA" | "IGP-M" | "INPC" | "outro" | null,
        proximoReajuste: v.proximoReajuste || null,
        imobiliariaId: v.imobiliariaId || null,
        proprietarioNome: v.proprietarioNome,
        proprietarioDocumento: v.proprietarioDocumento,
        proprietarioContato: v.proprietarioContato,
        proprietarioConta: v.proprietarioConta,
        observacoes: v.observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      router.replace(imovel ? voltarPara : `/imoveis/imoveis/${r.id}`);
      router.refresh();
    });
  }

  function excluir() {
    if (!imovel || !window.confirm(`Excluir o imóvel “${imovel.nome}” com suas unidades, contas e entrega? O histórico da alteração fica registrado.`)) return;
    iniciar(async () => {
      const r = await excluirImovel(imovel.id);
      if (!r.sucesso) return setErro(r.erro);
      router.replace("/imoveis/imoveis");
      router.refresh();
    });
  }

  const campo = ESTILO_CAMPO_PADRAO;
  return (
    <form onSubmit={salvar} className="flex flex-col gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Imóvel</legend>
        <Campo rotulo="Nome" htmlFor="i-nome"><input id="i-nome" required className={campo} value={v.nome} onChange={set("nome")} /></Campo>
        <CampoEndereco id="i-end" valor={v.endereco} aoMudar={(endereco) => setV((x) => ({ ...x, endereco }))} />
        <Campo rotulo="Secretaria" htmlFor="i-sec">
          <select id="i-sec" required className={campo} value={v.secretariaId} onChange={set("secretariaId")}>
            <option value="">Escolha…</option>
            {secretarias.filter((s) => s.ativa || s.id === v.secretariaId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Setor de uso" htmlFor="i-setor"><input id="i-setor" className={campo} value={v.setor} onChange={set("setor")} /></Campo>
        <Campo rotulo="Vínculo com a Prefeitura" htmlFor="i-vinc">
          <select id="i-vinc" className={campo} value={v.vinculo} onChange={set("vinculo")}>
            <option value="alugado">Alugado</option>
            <option value="proprio">Próprio</option>
            <option value="cedido">Cedido</option>
          </select>
        </Campo>
        <Campo rotulo="Finalidade" htmlFor="i-fin" className="sm:col-span-2"><input id="i-fin" className={campo} value={v.finalidade} onChange={set("finalidade")} /></Campo>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Contrato</legend>
        <Campo rotulo="Número do contrato" htmlFor="i-ct"><input id="i-ct" className={campo} value={v.contratoNumero} onChange={set("contratoNumero")} /></Campo>
        <Campo rotulo="Início da vigência" htmlFor="i-vi"><input id="i-vi" type="date" className={campo} value={v.vigenciaInicio} onChange={set("vigenciaInicio")} /></Campo>
        <Campo rotulo="Fim da vigência" htmlFor="i-vf"><input id="i-vf" type="date" className={campo} value={v.vigenciaFim} onChange={set("vigenciaFim")} /></Campo>
        <Campo rotulo="Aluguel mensal (R$)" htmlFor="i-val"><input id="i-val" inputMode="decimal" className={campo} value={v.valorAluguel} onChange={set("valorAluguel")} /></Campo>
        <Campo rotulo="Dia do vencimento" htmlFor="i-dia"><input id="i-dia" type="number" min={1} max={31} className={campo} value={v.diaVencimento} onChange={set("diaVencimento")} /></Campo>
        <Campo rotulo="Índice de reajuste" htmlFor="i-idx">
          <select id="i-idx" className={campo} value={v.indiceReajuste} onChange={set("indiceReajuste")}>
            <option value="">—</option>
            {["IPCA", "IGP-M", "INPC", "outro"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Próximo reajuste" htmlFor="i-rj"><input id="i-rj" type="date" className={campo} value={v.proximoReajuste} onChange={set("proximoReajuste")} /></Campo>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Imobiliária e proprietário</legend>
        <Campo rotulo="Imobiliária" htmlFor="i-imob">
          <select id="i-imob" className={campo} value={v.imobiliariaId} onChange={set("imobiliariaId")}>
            <option value="">Sem imobiliária (direto com o proprietário)</option>
            {imobiliarias.filter((m) => m.ativa || m.id === v.imobiliariaId).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Proprietário" htmlFor="i-pn"><input id="i-pn" className={campo} value={v.proprietarioNome} onChange={set("proprietarioNome")} /></Campo>
        <Campo rotulo="CPF ou CNPJ do proprietário" htmlFor="i-pd" dica="Aparece mascarado nas telas."><input id="i-pd" className={campo} value={v.proprietarioDocumento} onChange={set("proprietarioDocumento")} /></Campo>
        <Campo rotulo="Contato" htmlFor="i-pc"><input id="i-pc" className={campo} value={v.proprietarioContato} onChange={set("proprietarioContato")} /></Campo>
        <Campo rotulo="Conta para pagamento" htmlFor="i-pb" className="sm:col-span-2"><input id="i-pb" className={campo} value={v.proprietarioConta} onChange={set("proprietarioConta")} placeholder="Banco, agência e conta" /></Campo>
        <Campo rotulo="Observações" htmlFor="i-obs" className="sm:col-span-2"><textarea id="i-obs" rows={3} className={campo} value={v.observacoes} onChange={set("observacoes")} /></Campo>
      </fieldset>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : imovel ? "Salvar alterações" : "Cadastrar imóvel"}</button>
        <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={() => router.push(voltarPara)}>Cancelar</button>
        {imovel && <button type="button" disabled={pendente} className={`${CLASSE_BOTAO_PERIGO} sm:ml-auto`} onClick={excluir}>Excluir imóvel</button>}
      </div>
    </form>
  );
}
