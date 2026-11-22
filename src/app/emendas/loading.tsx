import { CarregandoLento } from "@/components/modulo/estados-tela";
import { EsqueletoPagina } from "@/components/layout/esqueleto-pagina";

export default function CarregandoEmendas() {
  return (
    <>
      <CarregandoLento />
      <EsqueletoPagina />
    </>
  );
}
