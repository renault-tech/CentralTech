import "./portal.css";

/** Área pública de transparência: só carrega os estilos do portal (sem cabeçalho da plataforma, sem login). */
export default function LayoutTransparencia({ children }: { children: React.ReactNode }) {
  return children;
}
