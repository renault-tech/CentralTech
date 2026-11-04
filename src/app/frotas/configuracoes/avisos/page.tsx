import Link from "next/link";

import { Cartao } from "@/components/frotas/ui";

export const metadata = { title: "Avisos e acesso · Frotas" };

export default function PaginaAvisos() {
  return (
    <div className="flex flex-col gap-6">
      <Cartao titulo="Avisos no sino">
        <p className="text-sm text-slate-700">
          Todo dia, por volta das 8h, quem tem o perfil “Gestor de frotas” recebe no sino da Central: NF esperando a assinatura da secretaria ou a ida à Contabilidade,
          manutenção parada numa etapa, orçamento esperando análise, secretaria sem NF na quinzena (5 dias depois de ela acabar) e veículo que passou dos limites de custo.
          Cada situação é avisada uma vez, e de novo se piorar (de “atenção” para “crítico”). Os prazos e percentuais são os dos limites dos alertas.
        </p>
      </Cartao>
      <Cartao titulo="Quem acessa o módulo">
        <p className="text-sm text-slate-700">
          O acesso é concedido na Central, em{" "}
          <Link href="/configuracoes/usuarios" className="font-semibold text-[color:var(--modulo-tinta)] underline">
            Configurações → Usuários e acessos
          </Link>
          : o perfil “Gestor de frotas” (Setor de Frotas) edita tudo, e o perfil “Consulta” só visualiza. Quem o administrador remove do módulo na Central perde o acesso na hora.
        </p>
      </Cartao>
    </div>
  );
}
