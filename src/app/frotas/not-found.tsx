import { TelaNaoEncontrada } from "@/components/modulo/estados-tela";

export default function NaoEncontradaFrotas() {
  return <TelaNaoEncontrada objeto="registro" principal={{ href: "/frotas/veiculos", rotulo: "Voltar aos veículos" }} secundario={{ href: "/frotas", rotulo: "Ir ao Painel" }} />;
}
