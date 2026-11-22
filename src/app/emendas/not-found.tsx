import { TelaNaoEncontrada } from "@/components/modulo/estados-tela";

export default function NaoEncontradaEmendas() {
  return <TelaNaoEncontrada objeto="registro" principal={{ href: "/emendas/lista", rotulo: "Voltar para a lista" }} secundario={{ href: "/emendas", rotulo: "Ir ao Painel" }} />;
}
