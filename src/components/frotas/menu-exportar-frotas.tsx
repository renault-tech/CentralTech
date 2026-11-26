"use client";

import * as React from "react";

import { MenuExportar, type OpcaoExportar } from "@/components/modulo/menu-exportar";
import { useColunasExportacao } from "@/components/frotas/colunas-exportacao";
import { COLUNAS_RELATORIO, SEPARADOR_COLUNAS } from "@/lib/frotas/colunas";
import { ROTULO_RELATORIO, type IdRelatorio } from "@/lib/frotas/relatorios";
import { DialogoColunas } from "@/components/modulo/dialogo-colunas";

/**
 * "Exportar" do Frotas: o menu de sempre, mais "Escolher colunas…". O padrão é tudo; o que a pessoa
 * esconde fica guardado neste navegador (por relatório) e vai na URL de cada exportação.
 */
export function MenuExportarFrotas({ opcoes, compacto }: { opcoes: OpcaoExportar[]; compacto?: boolean }) {
  const { ocultas, guardar: guardarOcultas } = useColunasExportacao();
  const [aberto, setAberto] = React.useState(false);

  const relatorios = [...new Set(opcoes.map((o) => o.relatorio).filter((r): r is IdRelatorio => !!r && r in COLUNAS_RELATORIO))];

  const comColunas = opcoes.map((o) => {
    const escondidas = o.relatorio ? ocultas[o.relatorio as IdRelatorio] : undefined;
    if (!o.href || !escondidas?.length) return o;
    return { ...o, href: `${o.href}${o.href.includes("?") ? "&" : "?"}sem=${encodeURIComponent(escondidas.join(SEPARADOR_COLUNAS))}` };
  });
  const todas: OpcaoExportar[] =
    relatorios.length > 0
      ? [...comColunas, { rotulo: "Escolher colunas…", detalhe: "Define o que aparece nos arquivos", aoClicar: () => setAberto(true) }]
      : comColunas;

  function alterar(r: IdRelatorio, proximas: string[]) {
    const novo = { ...ocultas, [r]: proximas };
    if (proximas.length === 0) delete novo[r];
    guardarOcultas(novo);
  }

  return (
    <>
      <MenuExportar opcoes={todas} compacto={compacto} />
      {aberto && <DialogoColunas relatorios={relatorios.map((r) => ({ id: r, rotulo: ROTULO_RELATORIO[r], colunas: COLUNAS_RELATORIO[r] }))} ocultas={ocultas} alterar={(r, p) => alterar(r as IdRelatorio, p)} limparTudo={() => guardarOcultas({})} fechar={() => setAberto(false)} />}
    </>
  );
}
