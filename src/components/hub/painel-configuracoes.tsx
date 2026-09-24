"use client";

import * as React from "react";
import { Check, ShieldCheck } from "lucide-react";

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

  const colunas = 3 + TODOS_MODULOS.length; // Usuário, Admin, Ativo, Ações + 1 por módulo

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-cataguases-marinho">Usuários e acessos</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cada coluna colorida mostra se a pessoa já tem aquele módulo liberado.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400">
              <th />
              <th
                colSpan={TODOS_MODULOS.length}
                className="border-b border-slate-100 pb-1 text-center font-medium uppercase tracking-wide"
              >
                Módulos liberados
              </th>
              <th colSpan={3} />
            </tr>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Usuário</th>
              {TODOS_MODULOS.map((m) => (
                <th key={m.chave} className="px-2 py-1.5 text-center font-medium" title={m.nome}>
                  <span
                    className="inline-flex h-1.5 w-1.5 rounded-full align-middle"
                    style={{ backgroundColor: m.cor }}
                    aria-hidden
                  />{" "}
                  {m.nomeCurto}
                </th>
              ))}
              <th className="px-2 py-1.5 text-center font-medium">Admin</th>
              <th className="px-2 py-1.5 text-center font-medium">Ativo</th>
              <th className="py-1.5 pl-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="py-2 pr-3">
                  <p className="font-medium text-slate-800">{u.nome}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                {TODOS_MODULOS.map((m) => {
                  const liberado = u.modulos.includes(m.chave);
                  return (
                    <td key={m.chave} className="px-2 py-2 text-center">
                      {liberado ? (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${m.cor}1A`, color: m.corTexto }}
                          title={`${m.nomeCurto}: liberado`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                        </span>
                      ) : (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center text-slate-300"
                          title={`${m.nomeCurto}: sem acesso`}
                          aria-hidden
                        >
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  {u.adminHub ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(233,166,59,0.14)] px-2 py-0.5 text-[11px] font-medium text-[#9C6A17]"
                      title="Administrador do Hub"
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      Admin
                    </span>
                  ) : (
                    <span className="text-slate-300" aria-hidden>
                      —
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  <span
                    className={
                      u.ativo
                        ? "inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
                        : "inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                    }
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="py-2 pl-2 text-right">
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
                <td colSpan={colunas} className="py-4 text-center text-xs text-slate-400">
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
        <p className="text-xs text-slate-500">Módulos liberados</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {TODOS_MODULOS.map((m) => {
            const marcado = modulos.includes(m.chave);
            return (
              <label
                key={m.chave}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  marcado ? "border-slate-300 bg-white" : "border-slate-200 bg-slate-100/60 text-slate-500"
                }`}
                style={marcado ? { borderColor: `${m.cor}55` } : undefined}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) =>
                    setModulos((prev) =>
                      e.target.checked ? [...prev, m.chave] : prev.filter((x) => x !== m.chave)
                    )
                  }
                />
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.cor }}
                  aria-hidden
                />
                <span className={marcado ? "font-medium text-slate-700" : undefined}>{m.nome}</span>
              </label>
            );
          })}
        </div>
        {usuario?.modulos.includes("numera") && !modulos.includes("numera") && (
          <p className="mt-1.5 text-xs text-amber-700">
            Numera tem projeto próprio, sem SSO — desmarcar aqui só tira o cartão do Hub, a conta de
            lá continua ativa. Para desativar de verdade, entre no Numera → Configurações → Usuários.
          </p>
        )}
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
