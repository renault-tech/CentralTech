"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import { definirAcesso } from "@/lib/actions/configuracoes";
import { MODULOS } from "@/lib/modulos-info";
import type { UsuarioComAcessos } from "@/lib/dados/usuarios";
import type { Modulo } from "@/types/database";

const TODOS_MODULOS = Object.values(MODULOS);

export function PainelConfiguracoes({ usuarios }: { usuarios: UsuarioComAcessos[] }) {
  const [editando, setEditando] = React.useState<UsuarioComAcessos | null>(null);
  const [mostrarForm, setMostrarForm] = React.useState(false);

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Nome</th>
              <th className="py-1.5 pr-3 font-medium">E-mail</th>
              <th className="py-1.5 pr-3 font-medium">Módulos</th>
              <th className="py-1.5 pr-3 font-medium">Admin do hub</th>
              <th className="py-1.5 pr-3 font-medium">Ativo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3">{u.nome}</td>
                <td className="py-1.5 pr-3 text-slate-500">{u.email}</td>
                <td className="py-1.5 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {u.modulos.length === 0 && <span className="text-xs text-slate-400">—</span>}
                    {u.modulos.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: `${MODULOS[m].cor}66`, color: MODULOS[m].cor }}
                      >
                        {MODULOS[m].nome}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-1.5 pr-3">{u.adminHub ? "Sim" : "Não"}</td>
                <td className="py-1.5 pr-3">{u.ativo ? "Sim" : "Não"}</td>
                <td className="py-1.5 pr-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditando(u);
                      setMostrarForm(true);
                    }}
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-slate-400">
                  Nenhum usuário com acesso ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!mostrarForm ? (
        <Button
          size="sm"
          className="mt-3"
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
        >
          Conceder acesso
        </Button>
      ) : (
        <FormularioAcesso usuario={editando} onFechar={() => setMostrarForm(false)} />
      )}
    </section>
  );
}

function FormularioAcesso({
  usuario,
  onFechar,
}: {
  usuario: UsuarioComAcessos | null;
  onFechar: () => void;
}) {
  const acao = useAcao();
  const [email, setEmail] = React.useState(usuario?.email ?? "");
  const [nome, setNome] = React.useState(usuario?.nome ?? "");
  const [adminHub, setAdminHub] = React.useState(usuario?.adminHub ?? false);
  const [modulos, setModulos] = React.useState<Modulo[]>(usuario?.modulos ?? []);
  const [ativo, setAtivo] = React.useState(usuario?.ativo ?? true);

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">
        {usuario ? `Editando acesso de ${usuario.nome}` : "Conceder novo acesso"}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">E-mail (já cadastrado na plataforma)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!usuario}
            className={`${ESTILO_CAMPO} mt-1 w-full disabled:bg-slate-100`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${ESTILO_CAMPO} mt-1 w-full`}
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs text-slate-500">Módulos visíveis</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {TODOS_MODULOS.map((m) => (
            <label
              key={m.chave}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                checked={modulos.includes(m.chave)}
                onChange={(e) =>
                  setModulos((prev) =>
                    e.target.checked ? [...prev, m.chave] : prev.filter((x) => x !== m.chave)
                  )
                }
              />
              {m.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-4">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={adminHub}
            onChange={(e) => setAdminHub(e.target.checked)}
          />
          Admin do hub (vê e gerencia tudo)
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
      </div>

      {acao.erro && <p className="mt-2 text-xs text-red-700">{acao.erro}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={acao.pendente || !email || !nome}
          onClick={() =>
            acao.executar(
              () => definirAcesso({ email, nome, adminHub, modulos, ativo }),
              onFechar
            )
          }
        >
          {acao.pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
