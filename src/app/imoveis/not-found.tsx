import { TelaNaoEncontrada } from "@/components/modulo/estados-tela";

export default function NaoEncontradaImoveis() {
  return <TelaNaoEncontrada objeto="imóvel" principal={{ href: "/imoveis/imoveis", rotulo: "Voltar aos imóveis" }} secundario={{ href: "/imoveis", rotulo: "Ir ao Painel" }} />;
}
