import { Bell, Building2, Gauge, Wrench } from "lucide-react";

import { IndiceConfiguracoes, type CartaoConfiguracao } from "@/components/layout/indice-configuracoes";

export const metadata = { title: "Configurações · Frotas" };

const CARTOES: CartaoConfiguracao[] = [
  { href: "/frotas/configuracoes/limites", titulo: "Limites dos alertas", descricao: "Dias de atenção e crítico, percentuais de custo e demais limites do painel.", Icone: Gauge, cor: "#D98614" },
  { href: "/frotas/configuracoes/secretarias", titulo: "Secretarias", descricao: "Catálogo de secretarias e quais controlam combustível.", Icone: Building2, cor: "#0D9488" },
  { href: "/frotas/configuracoes/fornecedores", titulo: "Postos, oficinas e locadoras", descricao: "Cadastro dos fornecedores usados nas NFs e nas manutenções.", Icone: Wrench, cor: "#5C7A1F" },
  { href: "/frotas/configuracoes/avisos", titulo: "Avisos e acesso", descricao: "Quem recebe os avisos no sino e como o acesso ao módulo é concedido.", Icone: Bell, cor: "#2563A8" },
];

export default function PaginaConfiguracoesFrotas() {
  return <IndiceConfiguracoes cartoes={CARTOES} />;
}
