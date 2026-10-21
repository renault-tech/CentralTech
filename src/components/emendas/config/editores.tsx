"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";

import { salvarBeneficiario, salvarExercicio, salvarSecretaria, salvarUnidade, salvarVereador } from "@/lib/emendas/actions-config";
import type { Resultado } from "@/lib/emendas/actions";
import { brl, numeroVereador } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { Beneficiario, Exercicio, Secretaria, UnidadeOrcamentaria, Vereador } from "@/types/emendas";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB]";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#6B4FBB] px-3.5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50";

function paraNumero(t: string): number | null {
  const limpo = t.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
}

function useSalvar() {
  const router = useRouter();
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  async function salvar(fn: () => Promise<Resultado>, depois?: () => void) {
    setSalvando(true);
    setErro(null);
    const r = await fn();
    setSalvando(false);
    if (!r.sucesso) return setErro(r.erro);
    depois?.();
    router.refresh();
  }
  return { erro, salvando, salvar };
}

function Secao({ titulo, apoio, children }: { titulo: string; apoio?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-[15px] font-semibold text-cataguases-marinho">{titulo}</h2>
      {apoio && <p className="mt-0.5 text-[13px] text-slate-600">{apoio}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? (
    <p className="mt-2 text-sm text-red-700" role="alert">
      {texto}
    </p>
  ) : null;
}

// --------------------------------------------------------------- exercício

export function EditorExercicios({ exercicios }: { exercicios: Exercicio[] }) {
  const [editando, setEditando] = React.useState<number | "novo" | null>(exercicios.length ? null : "novo");
  return (
    <Secao
      titulo="Exercícios"
      apoio="Cada ano tem sua cota por vereador e o mínimo na Saúde. A cota vale como bloqueio no cadastro; os 50% na Saúde, como alerta."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-3 font-medium">Ano</th>
              <th className="py-2 pr-3 font-medium">Cota por vereador</th>
              <th className="py-2 pr-3 font-medium">Mínimo na Saúde</th>
              <th className="py-2 pr-3 font-medium">RCL (opcional)</th>
              <th className="py-2 pr-3 font-medium">Situação</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {exercicios.map((e) =>
              editando === e.ano ? (
                <LinhaExercicio key={e.ano} exercicio={e} aoFechar={() => setEditando(null)} />
              ) : (
                <tr key={e.ano} className="border-t border-slate-100">
                  <td className="py-2.5 pr-3 font-semibold">{e.ano}</td>
                  <td className="py-2.5 pr-3 tabular-nums">{brl(e.cota_por_vereador)}</td>
                  <td className="py-2.5 pr-3">{e.percentual_saude_min}%</td>
                  <td className="py-2.5 pr-3 tabular-nums">{e.rcl ? `${brl(e.rcl)}${e.percentual_rcl ? ` · ${e.percentual_rcl}%` : ""}` : "—"}</td>
                  <td className="py-2.5 pr-3">{e.situacao === "aberto" ? "Aberto" : "Encerrado"}</td>
                  <td>
                    <button type="button" aria-label={`Editar ${e.ano}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditando(e.ano)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            )}
            {editando === "novo" && <LinhaExercicio aoFechar={() => setEditando(null)} />}
          </tbody>
        </table>
      </div>
      {editando !== "novo" && (
        <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditando("novo")}>
          <Plus className="h-4 w-4" aria-hidden /> Novo exercício
        </button>
      )}
    </Secao>
  );
}

function LinhaExercicio({ exercicio, aoFechar }: { exercicio?: Exercicio; aoFechar: () => void }) {
  const [ano, setAno] = React.useState(String(exercicio?.ano ?? new Date().getFullYear() + 1));
  const [cota, setCota] = React.useState(exercicio ? exercicio.cota_por_vereador.toFixed(2).replace(".", ",") : "");
  const [saude, setSaude] = React.useState(String(exercicio?.percentual_saude_min ?? 50));
  const [rcl, setRcl] = React.useState(exercicio?.rcl ? exercicio.rcl.toFixed(2).replace(".", ",") : "");
  const [pRcl, setPRcl] = React.useState(exercicio?.percentual_rcl ? String(exercicio.percentual_rcl) : "");
  const [situacao, setSituacao] = React.useState<"aberto" | "encerrado">(exercicio?.situacao ?? "aberto");
  const { erro, salvando, salvar } = useSalvar();
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="py-2 pr-3">
        <input className={CAMPO} disabled={!!exercicio} value={ano} onChange={(e) => setAno(e.target.value.replace(/\D/g, ""))} aria-label="Ano" />
      </td>
      <td className="py-2 pr-3">
        <input className={CAMPO} inputMode="decimal" value={cota} onChange={(e) => setCota(e.target.value)} aria-label="Cota por vereador" />
      </td>
      <td className="py-2 pr-3">
        <input className={CAMPO} inputMode="decimal" value={saude} onChange={(e) => setSaude(e.target.value)} aria-label="Mínimo na Saúde (%)" />
      </td>
      <td className="py-2 pr-3">
        <div className="flex gap-1.5">
          <input className={CAMPO} inputMode="decimal" placeholder="RCL" value={rcl} onChange={(e) => setRcl(e.target.value)} aria-label="Receita corrente líquida" />
          <input className={cn(CAMPO, "w-16")} inputMode="decimal" placeholder="%" value={pRcl} onChange={(e) => setPRcl(e.target.value)} aria-label="Percentual da RCL" />
        </div>
      </td>
      <td className="py-2 pr-3">
        <select className={CAMPO} value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} aria-label="Situação">
          <option value="aberto">Aberto</option>
          <option value="encerrado">Encerrado</option>
        </select>
        <Erro texto={erro} />
      </td>
      <td className="py-2">
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Salvar"
            disabled={salvando}
            className="rounded p-1.5 text-green-700 hover:bg-green-50"
            onClick={() =>
              void salvar(
                () =>
                  salvarExercicio({
                    ano: Number(ano),
                    cota: paraNumero(cota) ?? 0,
                    saudeMin: paraNumero(saude) ?? 50,
                    rcl: paraNumero(rcl),
                    percentualRcl: paraNumero(pRcl),
                    situacao,
                  }),
                aoFechar
              )
            }
          >
            <Check className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Cancelar" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={aoFechar}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// --------------------------------------------------------------- vereadores

export function EditorVereadores({ vereadores }: { vereadores: Vereador[] }) {
  const [editando, setEditando] = React.useState<string | null>(null);
  return (
    <Secao titulo="Vereadores" apoio="O número é o mesmo da planilha (“02 - Nome”). Vereador que saiu fica inativo — o histórico continua.">
      <ul className="flex flex-col divide-y divide-slate-100">
        {vereadores.map((v) =>
          editando === v.id ? (
            <FormVereador key={v.id} vereador={v} aoFechar={() => setEditando(null)} />
          ) : (
            <li key={v.id} className={cn("flex items-center gap-3 py-2.5 text-[13px]", !v.ativo && "opacity-60")}>
              <span className="w-8 font-mono text-slate-500">{numeroVereador(v.numero)}</span>
              <span className="flex-1 font-medium text-cataguases-marinho">{v.nome}</span>
              <span className="text-slate-500">{v.partido ?? ""}</span>
              {!v.ativo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">inativo</span>}
              <button type="button" aria-label={`Editar ${v.nome}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditando(v.id)}>
                <Pencil className="h-4 w-4" />
              </button>
            </li>
          )
        )}
        {editando === "novo" && <FormVereador proximo={Math.max(0, ...vereadores.map((v) => v.numero)) + 1} aoFechar={() => setEditando(null)} />}
      </ul>
      {editando !== "novo" && (
        <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditando("novo")}>
          <Plus className="h-4 w-4" aria-hidden /> Novo vereador
        </button>
      )}
    </Secao>
  );
}

function FormVereador({ vereador, proximo, aoFechar }: { vereador?: Vereador; proximo?: number; aoFechar: () => void }) {
  const [numero, setNumero] = React.useState(String(vereador?.numero ?? proximo ?? 1));
  const [nome, setNome] = React.useState(vereador?.nome ?? "");
  const [partido, setPartido] = React.useState(vereador?.partido ?? "");
  const [ativo, setAtivo] = React.useState(vereador?.ativo ?? true);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(CAMPO, "w-16")} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} aria-label="Número" />
        <input className={cn(CAMPO, "min-w-[220px] flex-1")} placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" />
        <input className={cn(CAMPO, "w-28")} placeholder="Partido" value={partido} onChange={(e) => setPartido(e.target.value)} aria-label="Partido" />
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo
        </label>
        <button
          type="button"
          disabled={salvando}
          className={BOTAO}
          onClick={() => void salvar(() => salvarVereador({ id: vereador?.id, numero: Number(numero), nome, partido, ativo }), aoFechar)}
        >
          Salvar
        </button>
        <button type="button" className="text-sm text-slate-600 hover:underline" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <Erro texto={erro} />
    </li>
  );
}

// ------------------------------------------------ secretarias e unidades

export function EditorSecretarias({ secretarias, unidades }: { secretarias: Secretaria[]; unidades: UnidadeOrcamentaria[] }) {
  const [editSec, setEditSec] = React.useState<string | null>(null);
  const [editUni, setEditUni] = React.useState<string | null>(null);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Secao titulo="Secretarias" apoio="Unidade de permissão: quem edita uma secretaria edita todas as unidades orçamentárias dela.">
        <ul className="flex flex-col divide-y divide-slate-100">
          {secretarias.map((s) =>
            editSec === s.id ? (
              <FormSecretaria key={s.id} secretaria={s} aoFechar={() => setEditSec(null)} />
            ) : (
              <li key={s.id} className={cn("flex items-center gap-3 py-2.5 text-[13px]", !s.ativo && "opacity-60")}>
                <span className="flex-1 font-medium text-cataguases-marinho">{s.nome}</span>
                <span className="text-xs text-slate-500">{unidades.filter((u) => u.secretaria_id === s.id).length} unidade(s)</span>
                <button type="button" aria-label={`Editar ${s.nome}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditSec(s.id)}>
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            )
          )}
          {editSec === "novo" && <FormSecretaria aoFechar={() => setEditSec(null)} />}
        </ul>
        {editSec !== "novo" && (
          <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditSec("novo")}>
            <Plus className="h-4 w-4" aria-hidden /> Nova secretaria
          </button>
        )}
      </Secao>

      <Secao titulo="Unidades orçamentárias" apoio="Como aparecem na LOA (ex.: 02.09 Fundo de Saúde → secretaria Saúde).">
        <ul className="flex flex-col divide-y divide-slate-100">
          {unidades.map((u) =>
            editUni === u.id ? (
              <FormUnidade key={u.id} unidade={u} secretarias={secretarias} aoFechar={() => setEditUni(null)} />
            ) : (
              <li key={u.id} className={cn("flex items-center gap-3 py-2.5 text-[13px]", !u.ativo && "opacity-60")}>
                <span className="w-12 font-mono text-slate-500">{u.codigo}</span>
                <span className="flex-1 font-medium text-cataguases-marinho">{u.nome}</span>
                <span className="text-xs text-slate-500">{secretarias.find((s) => s.id === u.secretaria_id)?.nome}</span>
                <button type="button" aria-label={`Editar ${u.codigo}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditUni(u.id)}>
                  <Pencil className="h-4 w-4" />
                </button>
              </li>
            )
          )}
          {editUni === "novo" && <FormUnidade secretarias={secretarias} aoFechar={() => setEditUni(null)} />}
        </ul>
        {editUni !== "novo" && (
          <button type="button" className={cn(BOTAO, "mt-3")} onClick={() => setEditUni("novo")}>
            <Plus className="h-4 w-4" aria-hidden /> Nova unidade
          </button>
        )}
      </Secao>
    </div>
  );
}

function FormSecretaria({ secretaria, aoFechar }: { secretaria?: Secretaria; aoFechar: () => void }) {
  const [nome, setNome] = React.useState(secretaria?.nome ?? "");
  const [ativo, setAtivo] = React.useState(secretaria?.ativo ?? true);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(CAMPO, "min-w-[200px] flex-1")} value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da secretaria" />
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa
        </label>
        <button type="button" disabled={salvando} className={BOTAO} onClick={() => void salvar(() => salvarSecretaria({ id: secretaria?.id, nome, ativo }), aoFechar)}>
          Salvar
        </button>
        <button type="button" className="text-sm text-slate-600 hover:underline" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <Erro texto={erro} />
    </li>
  );
}

function FormUnidade({ unidade, secretarias, aoFechar }: { unidade?: UnidadeOrcamentaria; secretarias: Secretaria[]; aoFechar: () => void }) {
  const [codigo, setCodigo] = React.useState(unidade?.codigo ?? "02.");
  const [nome, setNome] = React.useState(unidade?.nome ?? "");
  const [secretariaId, setSecretariaId] = React.useState(unidade?.secretaria_id ?? "");
  const [ativo, setAtivo] = React.useState(unidade?.ativo ?? true);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(CAMPO, "w-20")} value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Código" />
        <input className={cn(CAMPO, "min-w-[160px] flex-1")} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" aria-label="Nome da unidade" />
        <select className={cn(CAMPO, "w-48")} value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)} aria-label="Secretaria">
          <option value="">Secretaria…</option>
          {secretarias.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa
        </label>
        <button
          type="button"
          disabled={salvando}
          className={BOTAO}
          onClick={() => void salvar(() => salvarUnidade({ id: unidade?.id, codigo, nome, secretariaId, ativo }), aoFechar)}
        >
          Salvar
        </button>
        <button type="button" className="text-sm text-slate-600 hover:underline" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <Erro texto={erro} />
    </li>
  );
}

// ------------------------------------------------------------- beneficiários

export function EditorBeneficiarios({ beneficiarios, usos }: { beneficiarios: Beneficiario[]; usos: Record<string, number> }) {
  const [busca, setBusca] = React.useState("");
  const [editando, setEditando] = React.useState<string | null>(null);
  const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = beneficiarios.filter((b) => !q || b.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(q) || (b.cnpj ?? "").includes(busca));
  return (
    <Secao titulo="Beneficiários" apoio="Entidades e órgãos que recebem as emendas. Completar o CNPJ ajuda na prestação de contas.">
      <input type="search" className={cn(CAMPO, "mb-3 max-w-sm")} placeholder="Buscar por nome ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar beneficiário" />
      <ul className="flex flex-col divide-y divide-slate-100">
        {lista.map((b) =>
          editando === b.id ? (
            <FormBeneficiario key={b.id} beneficiario={b} aoFechar={() => setEditando(null)} />
          ) : (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
              <span className="min-w-[200px] flex-1 font-medium text-cataguases-marinho">{b.nome}</span>
              <span className={cn("font-mono text-xs", b.cnpj ? "text-slate-600" : "text-amber-800")}>{b.cnpj ?? "sem CNPJ"}</span>
              <span className="text-xs text-slate-500">{b.tipo === "entidade" ? "Entidade" : "Órgão público"}</span>
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

function FormBeneficiario({ beneficiario, aoFechar }: { beneficiario: Beneficiario; aoFechar: () => void }) {
  const [nome, setNome] = React.useState(beneficiario.nome);
  const [cnpj, setCnpj] = React.useState(beneficiario.cnpj ?? "");
  const [tipo, setTipo] = React.useState(beneficiario.tipo);
  const { erro, salvando, salvar } = useSalvar();
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(CAMPO, "min-w-[200px] flex-1")} value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" />
        <input className={cn(CAMPO, "w-44")} placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} aria-label="CNPJ" />
        <select className={cn(CAMPO, "w-40")} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
          <option value="entidade">Entidade</option>
          <option value="orgao_publico">Órgão público</option>
        </select>
        <button type="button" disabled={salvando} className={BOTAO} onClick={() => void salvar(() => salvarBeneficiario({ id: beneficiario.id, nome, cnpj, tipo }), aoFechar)}>
          Salvar
        </button>
        <button type="button" className="text-sm text-slate-600 hover:underline" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      <Erro texto={erro} />
    </li>
  );
}
