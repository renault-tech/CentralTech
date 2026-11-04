import Link from "next/link";
import { redirect } from "next/navigation";

import { FormularioParametros, ListaFornecedores, ListaSecretarias } from "@/components/frotas/formularios-config";
import { Cartao, TituloPagina } from "@/components/frotas/ui";
import { listarFornecedores, listarSecretarias, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";

export const metadata = { title: "Configurações · Frotas" };

export default async function PaginaConfiguracoesFrotas() {
  const ctx = await obterContextoFrotas();
  if (ctx.situacao !== "ok" || !ctx.gestor) redirect("/frotas");
  const [params, secretarias, fornecedores] = await Promise.all([obterParametros(), listarSecretarias(), listarFornecedores()]);
  const por = (tipo: "posto" | "oficina" | "locadora") => fornecedores.filter((f) => f.tipo === tipo);

  return (
    <>
      <TituloPagina titulo="Configurações do módulo" subtitulo="Limites dos alertas e cadastros de apoio." />
      <div className="flex flex-col gap-6">
        <Cartao titulo="Limites dos alertas">
          <FormularioParametros params={params} />
        </Cartao>
        <Cartao titulo="Secretarias">
          <ListaSecretarias secretarias={secretarias} />
        </Cartao>
        <Cartao titulo="Postos, oficinas e locadoras">
          <div className="grid gap-8 lg:grid-cols-3">
            <ListaFornecedores tipo="posto" fornecedores={por("posto")} />
            <ListaFornecedores tipo="oficina" fornecedores={por("oficina")} />
            <ListaFornecedores tipo="locadora" fornecedores={por("locadora")} />
          </div>
        </Cartao>
        <Cartao titulo="Avisos no sino">
          <p className="text-sm text-slate-700">
            Todo dia, por volta das 8h, quem tem o perfil “Gestor de frotas” recebe no sino da Central: NF esperando a assinatura da secretaria ou a ida à Contabilidade,
            manutenção parada numa etapa, orçamento esperando análise, secretaria sem NF na quinzena (5 dias depois de ela acabar) e veículo que passou dos limites de custo.
            Cada situação é avisada uma vez, e de novo se piorar (de “atenção” para “crítico”). Os prazos e percentuais são os dos limites acima.
          </p>
        </Cartao>
        <Cartao titulo="Quem acessa o módulo">
          <p className="text-sm text-slate-700">
            O acesso é concedido na Central, em{" "}
            <Link href="/configuracoes/usuarios" className="font-semibold text-[#3F5A12] underline">Configurações → Usuários e acessos</Link>: o perfil
            “Gestor de frotas” (Setor de Frotas) edita tudo, e o perfil “Consulta” só visualiza. Quem o administrador remove do módulo na Central perde o acesso na hora.
          </p>
        </Cartao>
      </div>
    </>
  );
}
