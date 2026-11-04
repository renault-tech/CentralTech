"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { decidirOrcamento, excluirManutencao, registrarDocumentos, salvarManutencao } from "@/lib/frotas/actions";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_PERIGO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { Fornecedor, Manutencao } from "@/types/frotas";

export type OpcaoVeiculo = { id: string; rotulo: string; grupo: string };

/** Registro do orçamento enviado pela secretaria (e a correção dele, enquanto não foi decidido). */
export function FormularioOrcamento({
  manutencao,
  veiculos,
  oficinas,
  servicosConhecidos,
  dataHoje,
  voltarPara,
}: {
  manutencao: Manutencao | null;
  veiculos: OpcaoVeiculo[];
  oficinas: Fornecedor[];
  servicosConhecidos: string[];
  dataHoje: string;
  voltarPara: string;
}) {
  const router = useRouter();
  const [veiculoId, setVeiculoId] = React.useState(manutencao?.veiculo_id ?? "");
  const [servico, setServico] = React.useState(manutencao?.servico ?? "");
  const [descricao, setDescricao] = React.useState(manutencao?.descricao ?? "");
  const [oficinaId, setOficinaId] = React.useState(manutencao?.fornecedor_id ?? "");
  const [valor, setValor] = React.useState(valorParaCampo(manutencao?.orcamento_valor));
  const [recebidoEm, setRecebidoEm] = React.useState(manutencao?.orcamento_recebido_em ?? dataHoje);
  const [observacoes, setObservacoes] = React.useState(manutencao?.observacoes ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const aberto = !manutencao || manutencao.status_analise === "a_analisar" || manutencao.status_analise === "novo_orcamento";

  const grupos = React.useMemo(() => {
    const mapa = new Map<string, OpcaoVeiculo[]>();
    for (const v of veiculos) mapa.set(v.grupo, [...(mapa.get(v.grupo) ?? []), v]);
    return [...mapa.entries()];
  }, [veiculos]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const v = lerValor(valor);
    if (v === null || Number.isNaN(v)) return setErro("Informe o valor do orçamento (ex.: 4.850,00).");
    iniciar(async () => {
      const r = await salvarManutencao({
        id: manutencao?.id,
        veiculoId,
        fornecedorId: oficinaId || null,
        servico,
        descricao,
        orcamentoValor: v,
        orcamentoRecebidoEm: recebidoEm,
        observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      if (r.aviso) return setAviso(r.aviso);
      router.replace(r.id ? `/frotas/manutencao?id=${r.id}` : voltarPara);
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3.5">
      <Campo rotulo="Veículo" htmlFor="m-veiculo">
        <select id="m-veiculo" required disabled={!!manutencao} value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
          <option value="">Escolha…</option>
          {grupos.map(([grupo, lista]) => (
            <optgroup key={grupo} label={grupo}>
              {lista.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.rotulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Serviço" htmlFor="m-servico" dica="Nome curto, igual para o mesmo tipo de serviço: é ele que compara com serviços parecidos.">
          <input id="m-servico" required list="m-servicos" value={servico} onChange={(e) => setServico(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={80} />
          <datalist id="m-servicos">
            {servicosConhecidos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Oficina" htmlFor="m-oficina" dica={oficinas.length === 0 ? "Cadastre as oficinas em Configurações." : undefined}>
          <select id="m-oficina" value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Não informada</option>
            {oficinas.filter((o) => o.ativo || o.id === oficinaId).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Valor do orçamento" htmlFor="m-valor">
          <input id="m-valor" required disabled={!aberto} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} />
        </Campo>
        <Campo rotulo="Orçamento recebido em" htmlFor="m-recebido">
          <input id="m-recebido" type="date" required disabled={!aberto} value={recebidoEm} onChange={(e) => setRecebidoEm(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
      </div>
      {!aberto && <p className="text-xs text-slate-500">O orçamento já foi decidido: o valor e a data não mudam. Para outro valor, peça um novo orçamento.</p>}
      <Campo rotulo="Descrição do serviço" htmlFor="m-desc">
        <textarea id="m-desc" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} className={ESTILO_CAMPO_PADRAO} />
      </Campo>
      <Campo rotulo="Observações" htmlFor="m-obs">
        <textarea id="m-obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} className={ESTILO_CAMPO_PADRAO} />
      </Campo>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {aviso && <Mensagem tipo="aviso">Salvo. {aviso}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : manutencao ? "Salvar alterações" : "Registrar orçamento"}
        </button>
        {!manutencao && (
          <button type="button" onClick={() => router.replace(voltarPara)} className={CLASSE_BOTAO_SECUNDARIO}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** A decisão do Setor de Frotas sobre o orçamento. */
export function PainelDecisao({ id }: { id: string }) {
  const router = useRouter();
  const [observacao, setObservacao] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function decidir(decisao: "liberar" | "recusar" | "novo_orcamento") {
    setErro(null);
    if (decisao !== "liberar" && !observacao.trim()) return setErro("Escreva o motivo nas observações da análise.");
    iniciar(async () => {
      const r = await decidirOrcamento({ id, decisao, observacao });
      if (!r.sucesso) return setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo rotulo="Observações da análise" htmlFor="d-obs">
        <textarea id="d-obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={1000} className={ESTILO_CAMPO_PADRAO} placeholder="Motivo da liberação, da recusa ou do pedido de novo orçamento" />
      </Campo>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pendente} onClick={() => decidir("liberar")} className={CLASSE_BOTAO}>
          Liberar serviço
        </button>
        <button type="button" disabled={pendente} onClick={() => decidir("novo_orcamento")} className={CLASSE_BOTAO_SECUNDARIO}>
          Pedir novo orçamento
        </button>
        <button type="button" disabled={pendente} onClick={() => decidir("recusar")} className={CLASSE_BOTAO_PERIGO}>
          Recusar
        </button>
      </div>
    </div>
  );
}

/** OC do IPM, NF da oficina e as datas de cada etapa (o banco confere a ordem). */
export function FormularioDocumentos({ manutencao }: { manutencao: Manutencao }) {
  const router = useRouter();
  const m = manutencao;
  const [ocNumero, setOcNumero] = React.useState(m.oc_numero ?? "");
  const [ocValor, setOcValor] = React.useState(valorParaCampo(m.oc_valor));
  const [ocEmitida, setOcEmitida] = React.useState(m.oc_emitida_em ?? "");
  const [ocEnviada, setOcEnviada] = React.useState(m.oc_enviada_em ?? "");
  const [nfNumero, setNfNumero] = React.useState(m.nf_numero ?? "");
  const [nfEmissao, setNfEmissao] = React.useState(m.nf_emissao ?? "");
  const [nfValor, setNfValor] = React.useState(valorParaCampo(m.nf_valor));
  const [docs, setDocs] = React.useState(m.docs_retornaram_em ?? "");
  const [contabilidade, setContabilidade] = React.useState(m.enviada_contabilidade_em ?? "");
  const [observacoes, setObservacoes] = React.useState(m.observacoes ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setOk(false);
    const oc = lerValor(ocValor);
    const nf = lerValor(nfValor);
    if (Number.isNaN(oc) || Number.isNaN(nf)) return setErro("Confira os valores (ex.: 4.850,00).");
    iniciar(async () => {
      const r = await registrarDocumentos({
        id: m.id,
        ocNumero: ocNumero || null,
        ocValor: oc,
        ocEmitidaEm: ocEmitida || null,
        ocEnviadaEm: ocEnviada || null,
        nfNumero: nfNumero || null,
        nfEmissao: nfEmissao || null,
        nfValor: nf,
        docsRetornaramEm: docs || null,
        enviadaContabilidadeEm: contabilidade || null,
        observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      setOk(true);
      if (r.aviso) setAviso(r.aviso);
      router.refresh();
    });
  }

  function excluir() {
    if (!window.confirm("Excluir esta manutenção? O histórico da alteração fica registrado.")) return;
    iniciar(async () => {
      const r = await excluirManutencao(m.id);
      if (!r.sucesso) return setErro(r.erro);
      router.replace("/frotas/manutencao");
    });
  }

  const campo = "text-[13px]";
  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className={`mb-2 font-semibold text-cataguases-marinho ${campo}`}>Ordem de compra (IPM)</legend>
        <Campo rotulo="Nº da OC" htmlFor="o-num">
          <input id="o-num" value={ocNumero} onChange={(e) => setOcNumero(e.target.value)} className={ESTILO_CAMPO_PADRAO} placeholder="ex.: 1841/2026" maxLength={40} />
        </Campo>
        <Campo rotulo="Valor da OC" htmlFor="o-val">
          <input id="o-val" inputMode="decimal" value={ocValor} onChange={(e) => setOcValor(e.target.value)} className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} placeholder="0,00" />
        </Campo>
        <Campo rotulo="OC emitida em" htmlFor="o-em">
          <input id="o-em" type="date" value={ocEmitida} onChange={(e) => setOcEmitida(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
        <Campo rotulo="OC enviada à secretaria em" htmlFor="o-env">
          <input id="o-env" type="date" value={ocEnviada} onChange={(e) => setOcEnviada(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
      </fieldset>
      <fieldset className="grid gap-3 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
        <legend className={`mb-2 font-semibold text-cataguases-marinho ${campo}`}>Nota fiscal da oficina</legend>
        <Campo rotulo="Nº da NF" htmlFor="n-num">
          <input id="n-num" value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={40} />
        </Campo>
        <Campo rotulo="Data de emissão" htmlFor="n-em">
          <input id="n-em" type="date" value={nfEmissao} onChange={(e) => setNfEmissao(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
        <Campo rotulo="Valor da NF" htmlFor="n-val">
          <input id="n-val" inputMode="decimal" value={nfValor} onChange={(e) => setNfValor(e.target.value)} className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} placeholder="0,00" />
        </Campo>
      </fieldset>
      <fieldset className="grid gap-3 border-t border-slate-100 pt-3.5 sm:grid-cols-2">
        <legend className={`mb-2 font-semibold text-cataguases-marinho ${campo}`}>Retorno e Contabilidade</legend>
        <Campo rotulo="Documentação voltou ao Frotas em" htmlFor="r-docs">
          <input id="r-docs" type="date" value={docs} onChange={(e) => setDocs(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
        <Campo rotulo="Enviada à Contabilidade em" htmlFor="r-ctb">
          <input id="r-ctb" type="date" value={contabilidade} onChange={(e) => setContabilidade(e.target.value)} className={ESTILO_CAMPO_PADRAO} />
        </Campo>
      </fieldset>
      <Campo rotulo="Observações" htmlFor="r-obs">
        <textarea id="r-obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} className={ESTILO_CAMPO_PADRAO} />
      </Campo>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {aviso && <Mensagem tipo="aviso">{aviso}</Mensagem>}
      {ok && !erro && !aviso && <Mensagem tipo="ok">Salvo.</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : "Salvar documentação"}
        </button>
        <button type="button" onClick={excluir} disabled={pendente} className={`${CLASSE_BOTAO_PERIGO} ml-auto`}>
          Excluir manutenção
        </button>
      </div>
      <p className="text-xs text-slate-500">Se o valor da NF passar do valor da OC, o sistema avisa. Datas fora de ordem são recusadas, e cada alteração fica registrada.</p>
    </form>
  );
}
