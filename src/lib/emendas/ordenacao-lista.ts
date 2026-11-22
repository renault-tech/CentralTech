import { pontuarBusca } from "@/lib/emendas/painel-lista";
import type { EmendaResumo } from "@/types/emendas";

type Andamento = { concluidas: number; total: number };

const pctDe = (r?: Andamento) => (r && r.total > 0 ? Math.round((r.concluidas / r.total) * 100) : null);

/**
 * Ordem da lista de Emendas (mesma na tabela clássica e na área de trabalho). `ordemEtapas` = chaves das etapas
 * na ordem do fluxo. Com texto na busca e a ordem padrão, o que mais combina vem primeiro.
 */
export function ordenarEmendasLista(
  emendas: EmendaResumo[],
  ordem: string,
  q: string,
  resumos: Record<string, Andamento | undefined>,
  ordemEtapas: string[]
): EmendaResumo[] {
  return emendas.slice().sort((a, b) => {
    switch (ordem) {
      case "valor":
        return b.valor - a.valor;
      case "vereador":
        return a.vereador_numero - b.vereador_numero || a.numero_vereador - b.numero_vereador;
      case "etapa":
        return ordemEtapas.indexOf(b.etapa) - ordemEtapas.indexOf(a.etapa) || a.numero - b.numero;
      case "parada":
        return a.etapa_atualizada_em.localeCompare(b.etapa_atualizada_em);
      case "andamento":
        return (pctDe(resumos[b.id]) ?? -1) - (pctDe(resumos[a.id]) ?? -1) || a.numero - b.numero;
      case "atrasadas":
        return (pctDe(resumos[a.id]) ?? 101) - (pctDe(resumos[b.id]) ?? 101) || a.numero - b.numero;
      default: {
        if (q) {
          const pa = pontuarBusca({ numero: a.numero, objeto: a.objeto, outros: [a.beneficiario_nome ?? "", a.vereador_nome, a.secretaria_nome, a.unidade_codigo, a.ficha ?? ""] }, q);
          const pb = pontuarBusca({ numero: b.numero, objeto: b.objeto, outros: [b.beneficiario_nome ?? "", b.vereador_nome, b.secretaria_nome, b.unidade_codigo, b.ficha ?? ""] }, q);
          if (pa !== pb) return pb - pa;
        }
        return a.numero - b.numero;
      }
    }
  });
}
