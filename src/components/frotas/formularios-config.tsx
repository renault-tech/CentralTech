"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { salvarFornecedor, salvarParametros, salvarSecretaria } from "@/lib/frotas/actions";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { Fornecedor, ParametrosFrotas, SecretariaFrotas, TipoFornecedor } from "@/types/frotas";

/** Limites dos alertas (dias parado, % do valor do veículo etc.). */
export function FormularioParametros({ params }: { params: ParametrosFrotas }) {
  const router = useRouter();
  const [v, setV] = React.useState({
    diasAtencao: params.dias_atencao,
    diasCritico: params.dias_critico,
    pctAtencao: params.pct_atencao,
    pctCritico: params.pct_critico,
    reincidenciaQtd: params.reincidencia_qtd,
    reincidenciaMeses: params.reincidencia_meses,
    orcamentoAcimaPct: params.orcamento_acima_pct,
    combustivelAcimaPct: params.combustivel_acima_pct,
    inativoDias: params.inativo_dias,
  });
  const [msg, setMsg] = React.useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();

  const campos: { chave: keyof typeof v; rotulo: string; dica: string }[] = [
    { chave: "diasAtencao", rotulo: "Alerta amarelo a partir de (dias)", dica: "Documento parado na mesma etapa." },
    { chave: "diasCritico", rotulo: "Alerta vermelho a partir de (dias)", dica: "Igual ou maior que o amarelo." },
    { chave: "pctAtencao", rotulo: "Manutenção em atenção a partir de (% do valor)", dica: "Gasto de 12 meses ÷ valor do veículo." },
    { chave: "pctCritico", rotulo: "Avaliar baixa ou troca a partir de (% do valor)", dica: "Igual ou maior que o de atenção." },
    { chave: "reincidenciaQtd", rotulo: "Reincidência: manutenções a partir de", dica: "Quantas no mesmo veículo." },
    { chave: "reincidenciaMeses", rotulo: "Reincidência: janela (meses)", dica: "Período em que elas contam." },
    { chave: "orcamentoAcimaPct", rotulo: "Orçamento acima da média (%)", dica: "Comparado a serviços parecidos." },
    { chave: "combustivelAcimaPct", rotulo: "Combustível acima da média (%)", dica: "Quinzena × média das 6 anteriores." },
    { chave: "inativoDias", rotulo: "Veículo inativo com gasto (dias)", dica: "Janela para olhar o gasto." },
  ];

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await salvarParametros(v);
      if (!r.sucesso) return setMsg({ tipo: "erro", texto: r.erro });
      setMsg({ tipo: "ok", texto: "Limites salvos." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {campos.map((c) => (
          <Campo key={c.chave} rotulo={c.rotulo} htmlFor={`p-${c.chave}`} dica={c.dica}>
            <input
              id={`p-${c.chave}`}
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={v[c.chave]}
              onChange={(e) => setV({ ...v, [c.chave]: Number(e.target.value) })}
              className={`${ESTILO_CAMPO_PADRAO} tabular-nums`}
            />
          </Campo>
        ))}
      </div>
      {msg && <Mensagem tipo={msg.tipo}>{msg.texto}</Mensagem>}
      <div>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : "Salvar limites"}
        </button>
      </div>
    </form>
  );
}

/** Secretarias: quais devem ter uma NF de combustível por quinzena. */
export function ListaSecretarias({ secretarias }: { secretarias: SecretariaFrotas[] }) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [nova, setNova] = React.useState("");
  const [pendente, iniciar] = React.useTransition();

  function alterar(s: SecretariaFrotas, mudanca: Partial<Pick<SecretariaFrotas, "controla_combustivel" | "ativa">>) {
    setMsg(null);
    iniciar(async () => {
      const r = await salvarSecretaria({ id: s.id, nome: s.nome, controlaCombustivel: mudanca.controla_combustivel ?? s.controla_combustivel, ativa: mudanca.ativa ?? s.ativa });
      if (!r.sucesso) return setMsg(r.erro);
      router.refresh();
    });
  }

  function criar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await salvarSecretaria({ nome: nova, controlaCombustivel: true, ativa: true });
      if (!r.sucesso) return setMsg(r.erro);
      setNova("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs font-semibold text-slate-600">
            <tr>
              <th scope="col" className="py-2 pr-3">Secretaria</th>
              <th scope="col" className="py-2 pr-3">Deve ter NF de combustível por quinzena</th>
              <th scope="col" className="py-2">Ativa</th>
            </tr>
          </thead>
          <tbody>
            {secretarias.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 font-medium">{s.nome}</td>
                <td className="py-2 pr-3">
                  <input type="checkbox" aria-label={`${s.nome}: deve ter NF de combustível`} checked={s.controla_combustivel} disabled={pendente} onChange={(e) => alterar(s, { controla_combustivel: e.target.checked })} />
                </td>
                <td className="py-2">
                  <input type="checkbox" aria-label={`${s.nome}: ativa`} checked={s.ativa} disabled={pendente} onChange={(e) => alterar(s, { ativa: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Nova secretaria" htmlFor="s-nova" className="min-w-[220px] flex-1">
          <input id="s-nova" value={nova} onChange={(e) => setNova(e.target.value)} className={ESTILO_CAMPO_PADRAO} minLength={2} maxLength={120} required />
        </Campo>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>Adicionar</button>
      </form>
      {msg && <Mensagem tipo="erro">{msg}</Mensagem>}
    </div>
  );
}

const ROTULO_TIPO: Record<TipoFornecedor, string> = { posto: "Postos de combustível", oficina: "Oficinas", locadora: "Locadoras" };

/** Postos, oficinas e locadoras: cadastro simples (nome, CNPJ e se está ativo). */
export function ListaFornecedores({ tipo, fornecedores }: { tipo: TipoFornecedor; fornecedores: Fornecedor[] }) {
  const router = useRouter();
  const [nome, setNome] = React.useState("");
  const [cnpj, setCnpj] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function criar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await salvarFornecedor({ tipo, nome, cnpj, ativo: true });
      if (!r.sucesso) return setMsg(r.erro);
      setNome("");
      setCnpj("");
      router.refresh();
    });
  }

  function alternar(f: Fornecedor) {
    setMsg(null);
    iniciar(async () => {
      const r = await salvarFornecedor({ id: f.id, tipo: f.tipo, nome: f.nome, cnpj: f.cnpj, ativo: !f.ativo });
      if (!r.sucesso) return setMsg(r.erro);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-cataguases-marinho">{ROTULO_TIPO[tipo]}</h3>
      {fornecedores.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum cadastrado.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {fornecedores.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2">
              <span className={f.ativo ? "" : "text-slate-400 line-through"}>
                {f.nome}
                {f.cnpj ? <span className="ml-2 text-xs text-slate-500">{f.cnpj}</span> : null}
              </span>
              <button type="button" disabled={pendente} onClick={() => alternar(f)} className="text-xs font-semibold text-[#3F5A12] hover:underline">
                {f.ativo ? "Desativar" : "Reativar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={criar} className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Nome" htmlFor={`f-nome-${tipo}`} className="min-w-[200px] flex-[2]">
          <input id={`f-nome-${tipo}`} value={nome} onChange={(e) => setNome(e.target.value)} className={ESTILO_CAMPO_PADRAO} required minLength={2} maxLength={160} />
        </Campo>
        <Campo rotulo="CNPJ (opcional)" htmlFor={`f-cnpj-${tipo}`} className="min-w-[160px] flex-1">
          <input id={`f-cnpj-${tipo}`} value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={18} />
        </Campo>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>Adicionar</button>
      </form>
      {msg && <Mensagem tipo="erro">{msg}</Mensagem>}
    </div>
  );
}
