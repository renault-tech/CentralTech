"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem, SeloNivel } from "@/components/imoveis/ui";
import { excluirConta, salvarConta } from "@/lib/imoveis/actions";
import { analisarConsumo, referenciaDe, UNIDADE_DE_MEDIDA, type PontoConta } from "@/lib/imoveis/regras";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import type { Conta, ParametrosImoveis, TipoUnidade } from "@/types/imoveis";

export type OpcaoUnidade = { id: string; rotulo: string; tipo: TipoUnidade; historico: PontoConta[] };

/** Lançamento (digitado) de uma conta de água ou luz, com a comparação com a média na hora. */
export function FormularioConta({
  conta,
  unidades,
  par,
  mesPadrao,
  aoConcluir,
}: {
  conta: Conta | null;
  unidades: OpcaoUnidade[];
  par: ParametrosImoveis;
  mesPadrao: string;
  aoConcluir?: () => void;
}) {
  const router = useRouter();
  const [unidadeId, setUnidadeId] = React.useState(conta?.unidade_id ?? unidades[0]?.id ?? "");
  const [mes, setMes] = React.useState((conta?.referencia ?? mesPadrao).slice(0, 7));
  const [consumo, setConsumo] = React.useState(conta?.consumo != null ? String(conta.consumo).replace(".", ",") : "");
  const [valor, setValor] = React.useState(valorParaCampo(conta?.valor));
  const [vencimento, setVencimento] = React.useState(conta?.vencimento ?? "");
  const [pagoEm, setPagoEm] = React.useState(conta?.pago_em ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();

  const unidade = unidades.find((u) => u.id === unidadeId);
  const c = lerValor(consumo);
  const v = lerValor(valor);
  const previa = React.useMemo(() => {
    if (!unidade || c === null || Number.isNaN(c)) return null;
    const ref = `${mes}-01`;
    const base = unidade.historico.filter((p) => p.referencia !== ref);
    const valorInformado = v !== null && !Number.isNaN(v) && v > 0;
    const todas = analisarConsumo([...base, { referencia: ref, consumo: c, valor: valorInformado ? v : 0 }], par, UNIDADE_DE_MEDIDA[unidade.tipo]);
    // Sem o valor digitado ainda, não há como comparar o valor por unidade: só o consumo.
    return valorInformado ? todas : todas.filter((x) => x.tipo !== "valor_unitario");
  }, [unidade, c, v, mes, par]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    if (v === null || Number.isNaN(v)) return setErro("Informe o valor da conta (ex.: 214,30).");
    if (c !== null && Number.isNaN(c)) return setErro("O consumo está inválido.");
    iniciar(async () => {
      const r = await salvarConta({ id: conta?.id, unidadeId, referencia: referenciaDe(`${mes}-01`), consumo: c, valor: v, vencimento: vencimento || null, pagoEm: pagoEm || null });
      if (!r.sucesso) return setErro(r.erro);
      setOk(true);
      if (!conta) {
        setConsumo("");
        setValor("");
        setPagoEm("");
      }
      router.refresh();
      aoConcluir?.();
    });
  }

  function excluir() {
    if (!conta || !window.confirm("Excluir esta conta? O histórico da alteração fica registrado.")) return;
    iniciar(async () => {
      const r = await excluirConta(conta.id);
      if (!r.sucesso) return setErro(r.erro);
      router.refresh();
      aoConcluir?.();
    });
  }

  const campo = ESTILO_CAMPO_PADRAO;
  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Campo rotulo="Unidade (matrícula ou UC)" htmlFor="c-un" className="col-span-full sm:col-span-2">
          <select id="c-un" required className={campo} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} disabled={!!conta}>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.rotulo}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Mês" htmlFor="c-mes"><input id="c-mes" type="month" required className={campo} value={mes} onChange={(e) => setMes(e.target.value)} /></Campo>
        <Campo rotulo={`Consumo (${unidade ? UNIDADE_DE_MEDIDA[unidade.tipo] : ""})`} htmlFor="c-cons"><input id="c-cons" inputMode="decimal" className={campo} value={consumo} onChange={(e) => setConsumo(e.target.value)} /></Campo>
        <Campo rotulo="Valor (R$)" htmlFor="c-val"><input id="c-val" inputMode="decimal" required className={campo} value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo rotulo="Vencimento" htmlFor="c-venc"><input id="c-venc" type="date" className={campo} value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Campo>
        <Campo rotulo="Pago em" htmlFor="c-pago"><input id="c-pago" type="date" className={campo} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} /></Campo>
      </div>
      {previa && previa.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {previa.map((a) => (
            <span key={a.tipo} className="inline-flex items-center gap-2">
              <SeloNivel nivel={a.nivel === "critico" ? "critico" : "atencao"}>{a.nivel === "critico" ? "Acima do padrão" : "Fora do padrão"}</SeloNivel>
              <span className="text-slate-700">{a.texto}</span>
            </span>
          ))}
        </div>
      )}
      {previa && previa.length === 0 && c !== null && <p className="text-sm text-green-800">Dentro do padrão dos últimos meses.</p>}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {ok && <Mensagem tipo="ok">Conta salva.</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente || !unidadeId} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : conta ? "Salvar conta" : "Lançar conta"}</button>
        {conta && <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={excluir} disabled={pendente}>Excluir</button>}
      </div>
    </form>
  );
}
