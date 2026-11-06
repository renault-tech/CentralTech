"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/imoveis/ui";
import { salvarImobiliaria, salvarParametros, salvarSecretaria } from "@/lib/imoveis/actions";
import { PARAMETROS_PADRAO } from "@/lib/imoveis/regras";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import type { Imobiliaria, ParametrosImoveis, SecretariaImoveis } from "@/types/imoveis";

const CAMPOS_LIMITES = [
  { chave: "pctAcima", de: "pct_acima", rotulo: "Consumo acima da média", unidade: "%", dica: "Avisa quando o mês passa da média dos meses anteriores por mais que este percentual." },
  { chave: "pctAbaixo", de: "pct_abaixo", rotulo: "Consumo abaixo da média", unidade: "%", dica: "Pode indicar falha no medidor ou leitura estimada." },
  { chave: "mesesMedia", de: "meses_media", rotulo: "Meses usados na média", unidade: "meses", dica: "Quantos meses anteriores entram no cálculo (de 2 a 11)." },
  { chave: "diasFimContrato", de: "dias_fim_contrato", rotulo: "Aviso de fim de contrato", unidade: "dias", dica: "Avisa com esta antecedência; faltando 30 dias ou menos, vira crítico." },
  { chave: "diaLancamento", de: "dia_lancamento", rotulo: "Conta sem lançamento", unidade: "dia do mês", dica: "A partir deste dia, cobra as contas do mês ainda não lançadas." },
  { chave: "pctValor", de: "pct_valor", rotulo: "Valor por m³ ou kWh fora do padrão", unidade: "%", dica: "Detecta tarifa ou taxa cobrada a mais ou a menos." },
  { chave: "diasAtraso", de: "dias_atraso", rotulo: "Tolerância de atraso de conta", unidade: "dias", dica: "Dias depois do vencimento antes de marcar a conta como em atraso." },
] as const;

type Chave = (typeof CAMPOS_LIMITES)[number]["chave"];

/** Limites dos alertas: o gestor ajusta e as pendências se recalculam. */
export function FormularioLimites({ parametros }: { parametros: ParametrosImoveis }) {
  const router = useRouter();
  const inicial = React.useMemo(() => Object.fromEntries(CAMPOS_LIMITES.map((c) => [c.chave, String(parametros[c.de])])) as Record<Chave, string>, [parametros]);
  const [v, setV] = React.useState<Record<Chave, string>>(inicial);
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    iniciar(async () => {
      const n = Object.fromEntries(CAMPOS_LIMITES.map((c) => [c.chave, Number(v[c.chave])])) as Record<Chave, number>;
      const r = await salvarParametros(n);
      if (!r.sucesso) return setErro(r.erro);
      setOk(true);
      router.refresh();
    });
  }
  const restaurar = () => setV(Object.fromEntries(CAMPOS_LIMITES.map((c) => [c.chave, String(PARAMETROS_PADRAO[c.de])])) as Record<Chave, string>);

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_LIMITES.map((c) => (
          <Campo key={c.chave} rotulo={`${c.rotulo} (${c.unidade})`} htmlFor={`l-${c.chave}`} dica={c.dica}>
            <input id={`l-${c.chave}`} type="number" min={0} inputMode="numeric" required className={ESTILO_CAMPO_PADRAO} value={v[c.chave]} onChange={(e) => setV((x) => ({ ...x, [c.chave]: e.target.value }))} />
          </Campo>
        ))}
      </div>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {ok && <Mensagem tipo="ok">Limites salvos. As pendências já usam os novos valores.</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : "Salvar limites"}</button>
        <button type="button" className={CLASSE_BOTAO_SECUNDARIO} onClick={restaurar}>Restaurar padrão</button>
      </div>
    </form>
  );
}

/** Nova secretaria ou imobiliária, e ativar/desativar as existentes. */
export function EditorSecretarias({ secretarias }: { secretarias: SecretariaImoveis[] }) {
  const router = useRouter();
  const [nome, setNome] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const acao = (fn: () => Promise<{ sucesso: boolean; erro?: string }>) => iniciar(async () => { setErro(null); const r = await fn(); if (!r.sucesso) setErro(r.erro ?? "Não foi possível salvar."); else { setNome(""); router.refresh(); } });
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); acao(() => salvarSecretaria({ nome, ativa: true })); }} className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Nova secretaria" htmlFor="s-nome" className="min-w-[240px] flex-1"><input id="s-nome" required className={ESTILO_CAMPO_PADRAO} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>Adicionar</button>
      </form>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <ul className="divide-y divide-slate-100 text-sm">
        {secretarias.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2">
            <span className={s.ativa ? "" : "text-slate-400 line-through"}>{s.nome}</span>
            <button type="button" disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO} onClick={() => acao(() => salvarSecretaria({ id: s.id, nome: s.nome, ativa: !s.ativa }))}>{s.ativa ? "Desativar" : "Ativar"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditorImobiliarias({ imobiliarias }: { imobiliarias: Imobiliaria[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ nome: "", cnpj: "", telefone: "", email: "" });
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const acao = (fn: () => Promise<{ sucesso: boolean; erro?: string }>) => iniciar(async () => { setErro(null); const r = await fn(); if (!r.sucesso) setErro(r.erro ?? "Não foi possível salvar."); else { setF({ nome: "", cnpj: "", telefone: "", email: "" }); router.refresh(); } });
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); acao(() => salvarImobiliaria({ ...f, ativa: true })); }} className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Nova imobiliária" htmlFor="m-nome"><input id="m-nome" required className={ESTILO_CAMPO_PADRAO} value={f.nome} onChange={set("nome")} /></Campo>
        <Campo rotulo="CNPJ" htmlFor="m-cnpj"><input id="m-cnpj" className={ESTILO_CAMPO_PADRAO} value={f.cnpj} onChange={set("cnpj")} /></Campo>
        <Campo rotulo="Telefone" htmlFor="m-tel"><input id="m-tel" className={ESTILO_CAMPO_PADRAO} value={f.telefone} onChange={set("telefone")} /></Campo>
        <Campo rotulo="E-mail" htmlFor="m-mail"><input id="m-mail" type="email" className={ESTILO_CAMPO_PADRAO} value={f.email} onChange={set("email")} /></Campo>
        <div className="sm:col-span-4"><button type="submit" disabled={pendente} className={CLASSE_BOTAO}>Adicionar imobiliária</button></div>
      </form>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <ul className="divide-y divide-slate-100 text-sm">
        {imobiliarias.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className={m.ativa ? "" : "text-slate-400 line-through"}>{m.nome}<span className="block text-xs text-slate-500">{[m.cnpj, m.telefone, m.email].filter(Boolean).join(" · ")}</span></span>
            <button type="button" disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO} onClick={() => acao(() => salvarImobiliaria({ id: m.id, nome: m.nome, cnpj: m.cnpj, telefone: m.telefone, email: m.email, ativa: !m.ativa }))}>{m.ativa ? "Desativar" : "Ativar"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
