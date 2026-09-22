"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { importarUsuariosNumera, type LinhaImportacao } from "@/lib/actions/importar-numera";
import type { UsuarioNumera } from "@/lib/dados/numera";

const ROTULO_RESULTADO: Record<LinhaImportacao["resultado"], string> = {
  criado: "Conta criada",
  ja_tinha_acesso: "Módulo Numera adicionado",
  erro: "Erro",
};

export function ImportadorNumera({ usuarios }: { usuarios: UsuarioNumera[] }) {
  const pendentes = usuarios.filter((u) => !u.jaTemAcesso);
  const [selecionados, setSelecionados] = React.useState<Set<string>>(
    () => new Set(pendentes.map((u) => u.email))
  );
  const [pendente, setPendente] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [relatorio, setRelatorio] = React.useState<LinhaImportacao[] | null>(null);

  function alternar(email: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(email)) novo.delete(email);
      else novo.add(email);
      return novo;
    });
  }

  async function importar() {
    const alvo = pendentes.filter((u) => selecionados.has(u.email));
    if (alvo.length === 0) return;
    setPendente(true);
    setErro(null);
    setRelatorio(null);
    const resultado = await importarUsuariosNumera(
      alvo.map((u) => ({ email: u.email, nome: u.nome }))
    );
    setPendente(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setRelatorio(resultado.linhas);
  }

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-cataguases-marinho">Importar do Numera</h2>
      <p className="mt-1 text-xs text-slate-500">
        Cria acesso ao Hub (módulo Numera) para quem já tem conta aprovada no Numera. O primeiro
        acesso ao Hub é feito por &quot;Esqueci minha senha&quot; — o Numera é um projeto Supabase
        separado, a senha de lá não pode ser reaproveitada aqui. Rode de novo quando quiser trazer
        cadastros novos aprovados depois desta importação.
      </p>

      {usuarios.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Nenhum usuário do Numera disponível — confirme se `NUMERA_SUPABASE_URL` e
          `NUMERA_SUPABASE_ANON_KEY` estão configuradas nas variáveis de ambiente deste projeto.
        </p>
      ) : pendentes.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Todos os {usuarios.length} usuários aprovados do Numera já têm acesso ao Hub.
        </p>
      ) : (
        <>
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {pendentes.map((u) => (
              <label
                key={u.email}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(u.email)}
                  onChange={() => alternar(u.email)}
                />
                <span className="font-medium text-slate-700">{u.nome}</span>
                <span className="text-slate-400">{u.email}</span>
              </label>
            ))}
          </div>

          {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}

          <Button size="sm" className="mt-3" disabled={pendente || selecionados.size === 0} onClick={importar}>
            {pendente ? "Importando…" : `Importar selecionados (${selecionados.size})`}
          </Button>
        </>
      )}

      {relatorio && (
        <div className="mt-3 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
          {relatorio.map((l) => (
            <p key={l.email} className={l.resultado === "erro" ? "text-red-700" : "text-slate-600"}>
              <span className="font-medium">{l.email}</span> — {ROTULO_RESULTADO[l.resultado]}
              {l.detalhe && `: ${l.detalhe}`}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
