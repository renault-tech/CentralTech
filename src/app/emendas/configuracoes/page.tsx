import { Building2, CalendarRange, FileSpreadsheet, GitBranch, Landmark, ListChecks, ScanSearch, ShieldCheck, Users } from "lucide-react";

import { IndiceConfiguracoes, type CartaoConfiguracao } from "@/components/layout/indice-configuracoes";

export const metadata = { title: "Configurações · Emendas" };

const CARTOES: CartaoConfiguracao[] = [
  { href: "/emendas/configuracoes/exercicio", titulo: "Exercício", descricao: "Cota por vereador, mínimo da Saúde, LOA e dados de publicação.", Icone: CalendarRange, cor: "#6B4FBB" },
  { href: "/emendas/configuracoes/exequibilidade", titulo: "Exequibilidade", descricao: "Parecer por secretaria e impedimentos técnicos em lote.", Icone: ShieldCheck, cor: "#D98614" },
  { href: "/emendas/configuracoes/fases", titulo: "Fases do fluxo", descricao: "Etapas de cada modalidade e a ordem em que acontecem.", Icone: GitBranch, cor: "#2563A8" },
  { href: "/emendas/configuracoes/catalogo", titulo: "Fases e documentos por tipo", descricao: "Fases e checklist de cada tipo de execução.", Icone: ListChecks, cor: "#0D9488" },
  { href: "/emendas/configuracoes/vereadores", titulo: "Vereadores", descricao: "Lista de vereadores do exercício.", Icone: Landmark, cor: "#7C3AED" },
  { href: "/emendas/configuracoes/secretarias", titulo: "Secretarias e unidades", descricao: "Secretarias (unidade de permissão) e unidades orçamentárias.", Icone: Building2, cor: "#0D9488" },
  { href: "/emendas/configuracoes/beneficiarios", titulo: "Beneficiários", descricao: "Entidades e órgãos que recebem as emendas.", Icone: ScanSearch, cor: "#962A52" },
  { href: "/emendas/configuracoes/usuarios", titulo: "Usuários e permissões", descricao: "Perfil e permissão por secretaria de quem acessa o módulo.", Icone: Users, cor: "#639922" },
  { href: "/emendas/configuracoes/importar", titulo: "Importar planilha", descricao: "Carga de emendas por planilha, com prévia antes de gravar.", Icone: FileSpreadsheet, cor: "#E24B4A" },
];

export default function PaginaConfiguracoesEmendas() {
  return <IndiceConfiguracoes cartoes={CARTOES} />;
}
