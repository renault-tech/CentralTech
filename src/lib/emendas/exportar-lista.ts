import "server-only";

import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import {
  listarEmendas,
  listarMovimentos,
  obterCatalogoEtapas,
} from "@/lib/emendas/dados";
import { descreverFiltrosLista } from "@/lib/emendas/filtros-texto";
import {
  filtrarEmendasLista,
  lerFiltrosLista,
  ordenarEmendasLista,
  type PendenciasDaLinha,
} from "@/lib/emendas/painel-lista";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { etapasEmOrdem, infoEtapa, numeroVereador } from "@/lib/emendas/regras";
import type { EmendaResumo, Exercicio } from "@/types/emendas";

/**
 * A lista de emendas EXATAMENTE como a tela mostra: mesma função de filtro (`filtrarEmendasLista`), mesmas chaves da URL
 * (inclusive pendência e categoria do beneficiário, que a exportação antiga ignorava) e a mesma ordem. Roda com a sessão
 * de quem pede (RLS). Só calcula as pendências (carga mais pesada) quando algum filtro depende delas.
 */
export async function carregarListaParaExportar(
  p: URLSearchParams,
  exercicio: Exercicio,
) {
  const buscaOriginal = p.get("q") ?? "";
  const f = {
    ...lerFiltrosLista((k) => p.get(k), buscaOriginal),
    ordem: p.get("ordem") ?? "numero",
  };
  const [todas, catalogo] = await Promise.all([
    listarEmendas(exercicio.ano, true),
    obterCatalogoEtapas(),
  ]);

  let resumos: Record<string, ResumoLinha> = {};
  if (f.p || f.pe) {
    const movimentos = await listarMovimentos(todas.map((e) => e.id));
    const calculos = await calcularEmendasDoExercicio(
      todas,
      exercicio,
      movimentos,
    );
    resumos = {};
    for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);
  }
  const pendencias: Record<string, PendenciasDaLinha | undefined> = resumos;

  const filtradas = filtrarEmendasLista(todas, pendencias, f);
  const etapas = etapasEmOrdem(
    catalogo,
    new Set(todas.map((r) => r.etapa)),
  ).map((e) => e.chave);
  const emendas = ordenarEmendasLista(filtradas, f.ordem, f.q, etapas);

  const achar =
    (
      campo: "vereador_id" | "secretaria_id",
      nome: (e: EmendaResumo) => string,
    ) =>
    (id: string) => {
      const e = todas.find((x) => x[campo] === id);
      return e ? nome(e) : id;
    };
  const filtros = descreverFiltrosLista(f, buscaOriginal, {
    vereador: achar(
      "vereador_id",
      (e) => `${numeroVereador(e.vereador_numero)} · ${e.vereador_nome}`,
    ),
    secretaria: achar("secretaria_id", (e) => e.secretaria_nome),
    etapa: (chave) => infoEtapa(chave, catalogo).nome,
  });
  return {
    emendas,
    todas,
    resumos,
    catalogo,
    filtros,
    totalDoExercicio: todas.length,
  };
}
