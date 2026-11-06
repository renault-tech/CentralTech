import { Building, Building2, Gauge } from "lucide-react";

import { IndiceConfiguracoes, type CartaoConfiguracao } from "@/components/layout/indice-configuracoes";

export const metadata = { title: "Configurações · Imóveis e Consumo" };

const CARTOES: CartaoConfiguracao[] = [
  { href: "/imoveis/configuracoes/limites", titulo: "Limites dos alertas", descricao: "Consumo acima e abaixo da média, meses da média, fim de contrato, conta sem lançamento e atraso.", Icone: Gauge, cor: "#D98614" },
  { href: "/imoveis/configuracoes/secretarias", titulo: "Secretarias", descricao: "Quem usa cada imóvel. A secretaria também define o que o perfil “secretaria” enxerga.", Icone: Building2, cor: "#0E7490" },
  { href: "/imoveis/configuracoes/imobiliarias", titulo: "Imobiliárias", descricao: "Cadastro único, reaproveitado entre os contratos.", Icone: Building, cor: "#5C7A1F" },
];

export default function PaginaConfiguracoesImoveis() {
  return <IndiceConfiguracoes cartoes={CARTOES} />;
}
