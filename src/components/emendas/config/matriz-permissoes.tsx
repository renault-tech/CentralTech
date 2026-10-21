"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { definirPermissoes } from "@/lib/emendas/actions-config";
import { DESCRICAO_PERFIL, NOME_PERFIL } from "@/lib/emendas/regras";
import { cn } from "@/lib/utils";
import type { PerfilEfetivo, PerfilEmendas, Secretaria } from "@/types/emendas";

export type UsuarioMatriz = {
  id: string;
  nome: string;
  email: string;
  adminHub: boolean;
  /** null = liberado na Central, mas ainda sem perfil no módulo. */
  perfil: PerfilEmendas | null;
  secretariaId: string | null;
  permissoes: Record<string, { ver: boolean; editar: boolean }>;
};

const CAMPO =
  "h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-cataguases-marinho outline-none focus:border-[#6B4FBB] focus:ring-1 focus:ring-[#6B4FBB] disabled:bg-slate-100";

const COR_PERFIL: Record<PerfilEfetivo, string> = {
  admin: "bg-cataguases-marinho text-white",
  gestor: "bg-violet-100 text-violet-900",
  admin_secretaria: "bg-indigo-100 text-indigo-900",
  operador: "bg-blue-100 text-blue-900",
  consulta: "bg-slate-100 text-slate-700",
};

/** Matriz usuário × secretaria (Ver / Editar), como no mockup aprovado. O
 * banco (`emendas.definir_acesso`) é quem garante os limites — inclusive
 * que um admin de secretaria só mexe na própria equipe. */
export function MatrizPermissoes({
  usuarios,
  secretarias,
  meuPerfil,
  minhaSecretaria,
}: {
  usuarios: UsuarioMatriz[];
  secretarias: Secretaria[];
  meuPerfil: PerfilEfetivo;
  minhaSecretaria: string | null;
}) {
  const router = useRouter();
  const [selId, setSelId] = React.useState<string | null>(usuarios.find((u) => !u.adminHub)?.id ?? usuarios[0]?.id ?? null);
  const sel = usuarios.find((u) => u.id === selId) ?? null;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="flex-[1_1_320px] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-cataguases-marinho">Quem acessa o módulo</h2>
          <span className="text-xs text-slate-500">{usuarios.length}</span>
        </div>
        <ul>
          {usuarios.map((u) => {
            const perfil: PerfilEfetivo | null = u.adminHub ? "admin" : u.perfil;
            const nv = Object.values(u.permissoes).filter((p) => p.ver).length;
            const ne = Object.values(u.permissoes).filter((p) => p.editar).length;
            const resumo = !perfil
              ? "Liberado na Central, falta definir o perfil"
              : perfil === "admin" || perfil === "gestor"
                ? "Todas as secretarias"
                : `${ne ? `Edita ${ne} · ` : ""}vê ${nv === secretarias.length ? "todas" : `${nv} secretaria(s)`}`;
            const ativo = u.id === selId;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelId(u.id)}
                  aria-current={ativo ? "true" : undefined}
                  className={cn("flex w-full flex-col gap-1 border-t border-slate-100 px-4 py-3 text-left first:border-0 hover:bg-slate-50", ativo && "bg-violet-50/60 shadow-[inset_3px_0_0_#6B4FBB]")}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <strong className="text-sm font-semibold text-cataguases-marinho">{u.nome}</strong>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", perfil ? COR_PERFIL[perfil] : "bg-amber-100 text-amber-900")}>
                      {perfil ? NOME_PERFIL[perfil] : "Pendente"}
                    </span>
                  </span>
                  <span className="text-xs text-slate-600">{resumo}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          Novas pessoas entram pela Central: Configurações → Usuários e acessos (ou por uma solicitação de acesso).
        </p>
      </section>

      {sel && <Editor key={sel.id} usuario={sel} secretarias={secretarias} meuPerfil={meuPerfil} minhaSecretaria={minhaSecretaria} aoSalvar={() => router.refresh()} />}
    </div>
  );
}

function Editor({
  usuario,
  secretarias,
  meuPerfil,
  minhaSecretaria,
  aoSalvar,
}: {
  usuario: UsuarioMatriz;
  secretarias: Secretaria[];
  meuPerfil: PerfilEfetivo;
  minhaSecretaria: string | null;
  aoSalvar: () => void;
}) {
  const souAdmSecretaria = meuPerfil === "admin_secretaria";
  const [perfil, setPerfil] = React.useState<PerfilEmendas>(usuario.perfil ?? (souAdmSecretaria ? "operador" : "admin_secretaria"));
  const [secretariaId, setSecretariaId] = React.useState<string>(usuario.secretariaId ?? (souAdmSecretaria ? minhaSecretaria ?? "" : ""));
  const [mapa, setMapa] = React.useState<Record<string, { ver: boolean; editar: boolean }>>(usuario.permissoes);
  const [salvando, setSalvando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);

  if (usuario.adminHub) {
    return (
      <section className="flex-[999_1_560px] rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-cataguases-marinho">{usuario.nome}</h2>
        <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">{DESCRICAO_PERFIL.admin} Definido na Central (admin do Hub).</p>
      </section>
    );
  }

  const total = perfil === "gestor";
  const consulta = perfil === "consulta";
  const p = (id: string) => mapa[id] ?? { ver: false, editar: false };
  const alterar = (id: string, campo: "ver" | "editar", valor: boolean) =>
    setMapa((m) => {
      const atual = { ...(m[id] ?? { ver: false, editar: false }), [campo]: valor };
      if (campo === "editar" && valor) atual.ver = true;
      if (campo === "ver" && !valor) atual.editar = false;
      return { ...m, [id]: atual };
    });
  const atalho = (tipo: "propria_ve_outras" | "so_propria" | "ve_todas") =>
    setMapa(
      Object.fromEntries(
        secretarias.map((s) => {
          const propria = s.id === secretariaId;
          return [s.id, { ver: tipo !== "so_propria" || propria, editar: tipo !== "ve_todas" && propria && !consulta }];
        })
      )
    );
  const perfisPermitidos: PerfilEmendas[] = souAdmSecretaria ? ["operador", "consulta"] : ["gestor", "admin_secretaria", "operador", "consulta"];

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    const r = await definirPermissoes({
      usuarioId: usuario.id,
      perfil,
      secretariaId: secretariaId || null,
      permissoes: total ? [] : secretarias.map((s) => ({ secretaria_id: s.id, ver: p(s.id).ver, editar: !consulta && p(s.id).editar })),
    });
    setSalvando(false);
    setMsg(r.sucesso ? { ok: true, texto: "Permissões salvas." } : { ok: false, texto: r.erro });
    if (r.sucesso) aoSalvar();
  }

  return (
    <section className="min-w-0 flex-[999_1_560px] rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-cataguases-marinho">{usuario.nome}</h2>
          <p className="text-[13px] text-slate-600">{usuario.email}</p>
          <p className="mt-1 max-w-xl text-[13px] text-slate-600">{DESCRICAO_PERFIL[perfil]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Perfil
            <select className={CAMPO} value={perfil} onChange={(e) => setPerfil(e.target.value as PerfilEmendas)}>
              {perfisPermitidos.map((k) => (
                <option key={k} value={k}>
                  {NOME_PERFIL[k]}
                </option>
              ))}
            </select>
          </label>
          {!total && (
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Secretaria da pessoa
              <select className={CAMPO} value={secretariaId} disabled={souAdmSecretaria} onChange={(e) => setSecretariaId(e.target.value)}>
                <option value="">{consulta ? "(nenhuma)" : "Escolha…"}</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {total ? (
        <p className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
          Gestor: vê e edita todas as secretarias. Para restringir, troque o perfil para Admin de secretaria ou Operador.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] text-slate-600">Atalhos:</span>
            {(
              [
                ["propria_ve_outras", "Edita a própria, vê as outras"],
                ["so_propria", "Só a própria"],
                ["ve_todas", "Só visualiza todas"],
              ] as const
            ).map(([k, rotulo]) => (
              <button key={k} type="button" onClick={() => atalho(k)} className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[13px] text-cataguases-marinho hover:bg-slate-50">
                {rotulo}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Secretaria</th>
                  <th scope="col" className="w-28 px-3.5 py-2.5 text-center font-medium">Visualizar</th>
                  <th scope="col" className="w-28 px-3.5 py-2.5 text-center font-medium">Editar</th>
                  <th scope="col" className="px-3.5 py-2.5 font-medium">Na prática</th>
                </tr>
              </thead>
              <tbody>
                {secretarias.map((s) => {
                  const x = p(s.id);
                  return (
                    <tr key={s.id} className={cn("border-t border-slate-100", s.id === secretariaId && "bg-indigo-50/40")}>
                      <th scope="row" className="px-3.5 py-2.5 text-left font-medium text-cataguases-marinho">
                        {s.nome}
                        {s.id === secretariaId && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-normal text-indigo-900">secretaria da pessoa</span>}
                      </th>
                      <td className="px-3.5 py-2.5 text-center">
                        <input type="checkbox" className="h-[18px] w-[18px] accent-[#6B4FBB]" aria-label={`Visualizar ${s.nome}`} checked={x.ver} disabled={x.editar} onChange={(e) => alterar(s.id, "ver", e.target.checked)} />
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <input type="checkbox" className="h-[18px] w-[18px] accent-[#6B4FBB]" aria-label={`Editar ${s.nome}`} checked={!consulta && x.editar} disabled={consulta} onChange={(e) => alterar(s.id, "editar", e.target.checked)} />
                      </td>
                      <td className={cn("px-3.5 py-2.5 text-xs", x.editar && !consulta ? "text-violet-900" : x.ver ? "text-slate-700" : "text-slate-500")}>
                        {x.editar && !consulta ? "Vê e registra a execução" : x.ver ? "Só visualiza" : "Não vê esta secretaria"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-600">Quem só visualiza não vê os botões de registro. A regra vale no banco de dados, não só na tela.</span>
        <div className="flex items-center gap-3">
          {msg && <span className={cn("text-sm", msg.ok ? "text-green-800" : "text-red-700")} role="status">{msg.texto}</span>}
          <button type="button" disabled={salvando} onClick={salvar} className="h-10 rounded-lg bg-[#6B4FBB] px-5 text-sm font-medium text-white hover:bg-[#5B3FA8] disabled:opacity-50">
            {salvando ? "Salvando…" : "Salvar permissões"}
          </button>
        </div>
      </div>
    </section>
  );
}
