"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, CLASSE_BOTAO, Mensagem } from "@/components/imoveis/ui";
import { salvarUnidade } from "@/lib/imoveis/actions";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

/** Cadastra a matrícula da água ou a UC da energia de um imóvel. */
export function FormularioUnidade({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [tipo, setTipo] = React.useState<"agua" | "luz">("agua");
  const [numero, setNumero] = React.useState("");
  const [titular, setTitular] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();
  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await salvarUnidade({ imovelId, tipo, numero, titular, ativa: true });
      if (!r.sucesso) return setErro(r.erro);
      setNumero("");
      setTitular("");
      router.refresh();
    });
  }
  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Tipo" htmlFor="u-tipo">
          <select id="u-tipo" className={ESTILO_CAMPO_PADRAO} value={tipo} onChange={(e) => setTipo(e.target.value as "agua" | "luz")}>
            <option value="agua">Água (matrícula)</option>
            <option value="luz">Luz (unidade consumidora)</option>
          </select>
        </Campo>
        <Campo rotulo="Número" htmlFor="u-num"><input id="u-num" required className={ESTILO_CAMPO_PADRAO} value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
        <Campo rotulo="Titular atual" htmlFor="u-tit" className="sm:col-span-2"><input id="u-tit" className={ESTILO_CAMPO_PADRAO} value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Prefeitura Municipal" /></Campo>
      </div>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <div><button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : "Adicionar unidade"}</button></div>
    </form>
  );
}
