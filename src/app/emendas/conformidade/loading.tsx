import { CarregandoLento } from "@/components/modulo/estados-tela";
import { EsqueletoLista } from "@/components/layout/esqueleto-lista";

export default function Carregando() {
  return (
    <>
      <CarregandoLento />
      <EsqueletoLista />
    </>
  );
}
