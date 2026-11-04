"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  decidirOrcamento,
  desfazerEtapa,
  excluirManutencao,
  registrarContabilidade,
  registrarNf,
  registrarOc,
  salvarManutencao,
  salvarObservacoesManutencao,
  type Resultado,
} from "@/lib/frotas/actions";
import { nfAcimaDaOc } from "@/lib/frotas/regras";
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

type EstadoEtapa = "feita" | "atual" | "bloqueada";

function brl(v: number | null) {
  return v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(iso: string | null) {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

/** Uma etapa da documentação: resumo quando feita (com "Corrigir"), formulário quando é a vez, aviso quando ainda não pode. */
function CartaoEtapa({
  numero,
  titulo,
  estado,
  resumo,
  bloqueio,
  podeDesfazer,
  onDesfazer,
  children,
}: {
  numero: number;
  titulo: string;
  estado: EstadoEtapa;
  resumo: string;
  bloqueio: string;
  podeDesfazer: boolean;
  onDesfazer: () => void;
  children: (fechar: () => void) => React.ReactNode;
}) {
  const [editando, setEditando] = React.useState(false);
  const aberto = estado === "atual" || editando;
  return (
    <section className={`rounded-lg border p-3.5 ${estado === "atual" ? "border-[color:var(--modulo)] bg-white" : "border-slate-200 bg-slate-50"}`} aria-label={titulo}>
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${estado === "feita" ? "bg-[color:var(--modulo-texto)] text-white" : estado === "atual" ? "border-2 border-[color:var(--modulo)] text-[color:var(--modulo-tinta)]" : "border border-slate-300 text-slate-500"}`}
          aria-hidden
        >
          {estado === "feita" ? "✓" : numero}
        </span>
        <h4 className="text-sm font-semibold text-cataguases-marinho">{titulo}</h4>
        {estado === "feita" && !editando && (
          <span className="ml-auto flex gap-3 text-xs">
            <button type="button" onClick={() => setEditando(true)} className="font-medium text-[color:var(--modulo-tinta)] underline underline-offset-2">
              Corrigir
            </button>
            {podeDesfazer && (
              <button type="button" onClick={onDesfazer} className="font-medium text-red-700 underline underline-offset-2">
                Desfazer
              </button>
            )}
          </span>
        )}
      </header>
      {estado === "feita" && !editando && <p className="mt-1.5 break-words pl-8 text-[13px] text-slate-700">{resumo}</p>}
      {estado === "bloqueada" && <p className="mt-1.5 pl-8 text-[13px] text-slate-500">{bloqueio}</p>}
      {aberto && <div className="mt-3">{children(() => setEditando(false))}</div>}
    </section>
  );
}

type PropsEtapas = { manutencao: Manutencao; dataHoje: string };

/** OC, NF e Contabilidade: três etapas separadas, cada uma salva sozinha e na hora em que acontece. */
export function EtapasDocumentacao({ manutencao: m, dataHoje }: PropsEtapas) {
  const router = useRouter();
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const temOc = !!m.oc_numero;
  const temNf = !!m.nf_numero;
  const temCtb = !!m.enviada_contabilidade_em;
  const dif = nfAcimaDaOc(m);

  function desfazer(etapa: "oc" | "nf" | "contabilidade") {
    const aviso =
      etapa === "oc"
        ? "Desfazer a OC? Ela é apagada."
        : etapa === "nf"
          ? "Desfazer a NF? Ela é apagada."
          : "Desfazer o envio à Contabilidade?";
    if (!window.confirm(aviso)) return;
    setErro(null);
    iniciar(async () => {
      const r = await desfazerEtapa({ id: m.id, etapa });
      if (!r.sucesso) return setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {dif !== null && (
        <Mensagem tipo="aviso">
          A NF ({brl(m.nf_valor)}) está {brl(dif)} acima da OC ({brl(m.oc_valor)}). Confira com a oficina antes de enviar à Contabilidade.
        </Mensagem>
      )}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <fieldset disabled={pendente} className="flex flex-col gap-3">
        <CartaoEtapa
          numero={1}
          titulo="Ordem de compra (OC do IPM)"
          estado={temOc ? "feita" : "atual"}
          resumo={`OC ${m.oc_numero} · ${brl(m.oc_valor)} · emitida em ${data(m.oc_emitida_em)}`}
          bloqueio=""
          podeDesfazer={!temNf}
          onDesfazer={() => desfazer("oc")}
        >
          {(fechar) => <FormOc key={`oc-${m.atualizado_em}`} m={m} dataHoje={dataHoje} aoSalvar={fechar} />}
        </CartaoEtapa>
        <CartaoEtapa
          numero={2}
          titulo="Nota fiscal da oficina"
          estado={temNf ? "feita" : temOc ? "atual" : "bloqueada"}
          resumo={`NF ${m.nf_numero} · ${brl(m.nf_valor)} · emitida em ${data(m.nf_emissao)}`}
          bloqueio="Disponível depois de registrar a OC."
          podeDesfazer={!temCtb}
          onDesfazer={() => desfazer("nf")}
        >
          {(fechar) => <FormNf key={`nf-${m.atualizado_em}`} m={m} dataHoje={dataHoje} aoSalvar={fechar} />}
        </CartaoEtapa>
        <CartaoEtapa
          numero={3}
          titulo="Envio à Contabilidade"
          estado={temCtb ? "feita" : temNf ? "atual" : "bloqueada"}
          resumo={`Enviada à Contabilidade em ${data(m.enviada_contabilidade_em)}`}
          bloqueio="Disponível depois de registrar a NF."
          podeDesfazer
          onDesfazer={() => desfazer("contabilidade")}
        >
          {(fechar) => <FormContabilidade key={`ct-${m.atualizado_em}`} m={m} dataHoje={dataHoje} aoSalvar={fechar} />}
        </CartaoEtapa>
      </fieldset>
      <Observacoes m={m} />
    </div>
  );
}

function useEnvio(aoSalvar: () => void) {
  const router = useRouter();
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  function enviar(acao: () => Promise<Resultado>) {
    setErro(null);
    setAviso(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.sucesso) return setErro(r.erro);
      if (r.aviso) setAviso(r.aviso);
      else aoSalvar();
      router.refresh();
    });
  }
  return { erro, aviso, pendente, enviar, setErro };
}

function Rodape({ erro, aviso, pendente, rotulo }: { erro: string | null; aviso: string | null; pendente: boolean; rotulo: string }) {
  return (
    <>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {aviso && <Mensagem tipo="aviso">{aviso}</Mensagem>}
      <div>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : rotulo}
        </button>
      </div>
    </>
  );
}

type PropsForm = { m: Manutencao; dataHoje: string; aoSalvar: () => void };

function FormOc({ m, dataHoje, aoSalvar }: PropsForm) {
  const [numero, setNumero] = React.useState(m.oc_numero ?? "");
  const [valor, setValor] = React.useState(valorParaCampo(m.oc_valor ?? m.orcamento_valor));
  const [emitida, setEmitida] = React.useState(m.oc_emitida_em ?? dataHoje);
  const { erro, aviso, pendente, enviar, setErro } = useEnvio(aoSalvar);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = lerValor(valor);
        if (v === null || Number.isNaN(v)) return setErro("Confira o valor (ex.: 4.850,00).");
        enviar(() => registrarOc({ id: m.id, ocNumero: numero, ocValor: v, ocEmitidaEm: emitida }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Nº da OC" htmlFor="o-num">
          <input id="o-num" value={numero} onChange={(e) => setNumero(e.target.value)} className={ESTILO_CAMPO_PADRAO} placeholder="ex.: 1841/2026" maxLength={40} required />
        </Campo>
        <Campo rotulo="Valor da OC" htmlFor="o-val">
          <input id="o-val" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} placeholder="0,00" required />
        </Campo>
        <Campo rotulo="OC emitida em" htmlFor="o-em">
          <input id="o-em" type="date" value={emitida} onChange={(e) => setEmitida(e.target.value)} className={ESTILO_CAMPO_PADRAO} required />
        </Campo>
      </div>
      <Rodape erro={erro} aviso={aviso} pendente={pendente} rotulo="Registrar OC" />
    </form>
  );
}

function FormNf({ m, dataHoje, aoSalvar }: PropsForm) {
  const [numero, setNumero] = React.useState(m.nf_numero ?? "");
  const [emissao, setEmissao] = React.useState(m.nf_emissao ?? dataHoje);
  const [valor, setValor] = React.useState(valorParaCampo(m.nf_valor));
  const { erro, aviso, pendente, enviar, setErro } = useEnvio(aoSalvar);
  const digitado = lerValor(valor);
  const acima = m.oc_valor !== null && digitado !== null && !Number.isNaN(digitado) && digitado > m.oc_valor;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (digitado === null || Number.isNaN(digitado)) return setErro("Confira o valor (ex.: 4.850,00).");
        enviar(() => registrarNf({ id: m.id, nfNumero: numero, nfEmissao: emissao, nfValor: digitado }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Nº da NF" htmlFor="n-num">
          <input id="n-num" value={numero} onChange={(e) => setNumero(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={40} required />
        </Campo>
        <Campo rotulo="Data de emissão" htmlFor="n-em">
          <input id="n-em" type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} className={ESTILO_CAMPO_PADRAO} required />
        </Campo>
        <Campo rotulo="Valor da NF" htmlFor="n-val">
          <input id="n-val" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} placeholder="0,00" required />
        </Campo>
      </div>
      {acima && <Mensagem tipo="aviso">Este valor passa da OC ({brl(m.oc_valor)}). Dá para salvar, mas confira com a oficina.</Mensagem>}
      <Rodape erro={erro} aviso={aviso} pendente={pendente} rotulo="Registrar NF" />
    </form>
  );
}

function FormContabilidade({ m, dataHoje, aoSalvar }: PropsForm) {
  const [dataEnvio, setDataEnvio] = React.useState(m.enviada_contabilidade_em ?? dataHoje);
  const { erro, aviso, pendente, enviar } = useEnvio(aoSalvar);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(() => registrarContabilidade({ id: m.id, enviadaContabilidadeEm: dataEnvio }));
      }}
    >
      <div className="max-w-xs">
        <Campo rotulo="Enviada à Contabilidade em" htmlFor="c-em">
          <input id="c-em" type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} className={ESTILO_CAMPO_PADRAO} required />
        </Campo>
      </div>
      <Rodape erro={erro} aviso={aviso} pendente={pendente} rotulo="Registrar envio" />
    </form>
  );
}

/** Observações e exclusão da manutenção. */
function Observacoes({ m }: { m: Manutencao }) {
  const router = useRouter();
  const [texto, setTexto] = React.useState(m.observacoes ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();
  return (
    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3.5">
      <Campo rotulo="Observações" htmlFor="r-obs">
        <textarea id="r-obs" rows={2} value={texto} onChange={(e) => { setTexto(e.target.value); setOk(false); }} maxLength={2000} className={ESTILO_CAMPO_PADRAO} />
      </Campo>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {ok && !erro && <Mensagem tipo="ok">Salvo.</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendente}
          className={CLASSE_BOTAO_SECUNDARIO}
          onClick={() =>
            iniciar(async () => {
              setErro(null);
              const r = await salvarObservacoesManutencao({ id: m.id, observacoes: texto });
              if (!r.sucesso) return setErro(r.erro);
              setOk(true);
              router.refresh();
            })
          }
        >
          Salvar observações
        </button>
        <button
          type="button"
          disabled={pendente}
          className={`${CLASSE_BOTAO_PERIGO} ml-auto`}
          onClick={() => {
            if (!window.confirm("Excluir esta manutenção? O histórico da alteração fica registrado.")) return;
            iniciar(async () => {
              const r = await excluirManutencao(m.id);
              if (!r.sucesso) return setErro(r.erro);
              router.replace("/frotas/manutencao");
            });
          }}
        >
          Excluir manutenção
        </button>
      </div>
      <p className="text-xs text-slate-500">Cada etapa é salva na hora em que acontece. Datas fora de ordem são recusadas, e cada alteração fica registrada.</p>
    </div>
  );
}
