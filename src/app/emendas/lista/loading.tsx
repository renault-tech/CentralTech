import { CarregandoLento } from "@/components/emendas/estados-tela";
import { EsqueletoLista } from "@/components/layout/esqueleto-lista";

export default function Carregando() {
  return (
    <>
      <CarregandoLento />
      <EsqueletoLista />
    </>
  );
}
