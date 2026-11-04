import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportadorOrcamentos } from "@/components/frotas/importador-orcamentos";
import type { OpcaoVeiculo } from "@/components/frotas/formularios-manutencao";
import { Cartao, TituloPagina } from "@/components/frotas/ui";
import { listarFornecedores, listarSecretarias, listarVeiculos, obterContextoFrotas } from "@/lib/frotas/dados";
import { dataNoFuso } from "@/lib/fuso";

export const metadata = { title: "Importar orçamentos · Frotas" };

export default async function PaginaImportarOrcamentos() {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/frotas/manutencao");
  const [veiculos, secretarias, oficinas] = await Promise.all([listarVeiculos(), listarSecretarias(), listarFornecedores("oficina")]);
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const opcoes: OpcaoVeiculo[] = veiculos
    .filter((v) => v.situacao !== "baixado")
    .map((v) => ({
      id: v.id,
      rotulo: `${v.placa ?? "Sem placa"} · ${v.modelo}${v.ano_modelo ? ` ${v.ano_modelo}` : ""} (${nomeSecretaria.get(v.secretaria_id) ?? "Sem secretaria"})`,
      grupo: nomeSecretaria.get(v.secretaria_id) ?? "Sem secretaria",
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return (
    <>
      <TituloPagina
        titulo="Importar orçamentos em PDF"
        subtitulo={
          <>
            Vários PDFs de uma vez; você confere os dados lidos antes de registrar.{" "}
            <Link href="/frotas/manutencao" className="font-semibold text-[#3F5A12] underline">Voltar às manutenções</Link>
          </>
        }
      />
      <Cartao>
        <ImportadorOrcamentos veiculos={opcoes} oficinas={oficinas.filter((o) => o.ativo)} dataHoje={dataNoFuso(new Date())} />
      </Cartao>
    </>
  );
}
