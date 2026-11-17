import { INFO_CATEGORIA, type CategoriaBeneficiario } from "@/lib/emendas/categorias";

/** Marca discreta da categoria do beneficiário: bolinha na cor da categoria + nome curto (mesmo desenho do selo do tipo). */
export function CategoriaSelo({ categoria }: { categoria: CategoriaBeneficiario | null | undefined }) {
  if (!categoria) return null;
  const c = INFO_CATEGORIA[categoria];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${c.cor}1F`, color: c.cor }} title={`${c.nome}: ${c.descricao}`}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.cor }} aria-hidden />
      {c.curto}
    </span>
  );
}
