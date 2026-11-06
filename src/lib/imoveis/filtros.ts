import type { Imovel } from "@/types/imoveis";

/** Filtros da lista de imóveis (valem na hora; moram na URL). Funções puras, testadas em `filtros.test.ts`. */
export type FiltroImoveis = { q: string; secretaria: string | null; situacao: string | null; vinculo: string | null; alerta: boolean };

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function lerFiltroImoveis(sp: Busca): FiltroImoveis {
  const situacao = um(sp.sit);
  return {
    q: um(sp.q).trim(),
    secretaria: um(sp.sec) || null,
    situacao: ["ativo", "em_entrega", "entregue"].includes(situacao) ? situacao : null,
    vinculo: ["alugado", "proprio", "cedido"].includes(um(sp.vinc)) ? um(sp.vinc) : null,
    alerta: um(sp.alerta) === "1",
  };
}

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarImoveis(imoveis: Imovel[], f: FiltroImoveis, comAlerta: Set<string>): Imovel[] {
  const q = sem(f.q);
  return imoveis.filter((i) => {
    if (f.secretaria && i.secretaria_id !== f.secretaria) return false;
    if (f.situacao && i.situacao !== f.situacao) return false;
    if (f.vinculo && i.vinculo !== f.vinculo) return false;
    if (f.alerta && !comAlerta.has(i.id)) return false;
    if (q && !sem(`${i.nome} ${i.endereco} ${i.contrato_numero ?? ""} ${i.proprietario_nome ?? ""} ${i.setor ?? ""}`).includes(q)) return false;
    return true;
  });
}
