/**
 * Template (recriado a cada navegação dentro de /frotas): reinicia a animação de entrada das seções da tela.
 * As seções de cada tela (filhas do elemento raiz dela) entram em sequência (CSS `.emd-pagina`), respeitando `prefers-reduced-motion`.
 */
export default function TemplateFrotas({ children }: { children: React.ReactNode }) {
  return <div className="emd-pagina">{children}</div>;
}
