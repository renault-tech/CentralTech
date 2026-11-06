/**
 * Planejamento (puro) da importação das planilhas de controle: casa cada linha com o que já existe e decide o que seria criado.
 * `montarPrevia` alimenta a tela de conferência; `planejarGravacao` calcula o que a action grava depois da confirmação. Nada aqui
 * toca no banco, então tudo é testado em `plano-contas.test.ts`.
 */

import { chave, chaveCodigo, enderecoEspecifico, secretariaDaAba, type AbaLida, type LinhaPlanilha } from "@/lib/imoveis/importacao/planilha-contas";
import type { TipoUnidade, VinculoImovel } from "@/types/imoveis";

export type Existentes = {
  secretarias: { id: string; nome: string }[];
  imoveis: { id: string; nome: string; endereco: string; secretaria_id: string }[];
  unidades: { id: string; imovel_id: string; tipo: TipoUnidade; numero: string }[];
  contas: { unidade_id: string; referencia: string }[];
};

export const chaveLinha = (l: Pick<LinhaPlanilha, "aba" | "linhaNumero">) => `${l.aba}#${l.linhaNumero}`;

const referencia = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`;

export type SituacaoLinha = "unidade_existente" | "nova" | "ignorada";
export type LinhaPrevia = {
  chave: string;
  linhaNumero: number;
  codigo: string;
  codigo2: string | null;
  setor: string;
  endereco: string;
  projeto: string | null;
  ignorada: string | null;
  situacao: SituacaoLinha;
  /** Unidade já cadastrada com este código. */
  unidadeId: string | null;
  /** Para unidade nova: imóvel existente que parece ser o mesmo (mesmo nome ou mesmo endereço específico). */
  imovelSugeridoId: string | null;
  mesesComValor: number;
  mesesNovos: number;
  mesesJaLancados: number;
};
export type AbaPrevia = { nome: string; secretariaSugerida: string | null; linhas: LinhaPrevia[] };

export function acharImovel(setor: string, endereco: string, secretariaId: string | null, imoveis: Existentes["imoveis"]): string | null {
  if (!secretariaId) return null;
  const doSetor = imoveis.filter((i) => i.secretaria_id === secretariaId);
  const porNome = doSetor.find((i) => chave(i.nome) === chave(setor));
  if (porNome) return porNome.id;
  if (enderecoEspecifico(endereco)) return doSetor.find((i) => chave(i.endereco) === chave(endereco))?.id ?? null;
  return null;
}

export function montarPrevia(abas: AbaLida[], tipo: TipoUnidade, ano: number, ex: Existentes): AbaPrevia[] {
  const porCodigo = new Map(ex.unidades.filter((u) => u.tipo === tipo).map((u) => [chaveCodigo(u.numero), u]));
  const lancadas = new Set(ex.contas.map((c) => `${c.unidade_id}|${c.referencia}`));
  return abas.map((a) => {
    const secretariaSugerida = secretariaDaAba(a.nome, ex.secretarias);
    return {
      nome: a.nome,
      secretariaSugerida,
      linhas: a.linhas.map((l): LinhaPrevia => {
        const un = porCodigo.get(chaveCodigo(l.codigo)) ?? null;
        const meses = l.valores.map((v, i) => (v === null ? null : referencia(ano, i + 1)));
        const comValor = meses.filter((m): m is string => m !== null);
        const jaLancados = un ? comValor.filter((m) => lancadas.has(`${un.id}|${m}`)).length : 0;
        return {
          chave: chaveLinha(l),
          linhaNumero: l.linhaNumero,
          codigo: l.codigo,
          codigo2: l.codigo2,
          setor: l.setor,
          endereco: l.endereco,
          projeto: l.projeto,
          ignorada: l.ignorada,
          situacao: l.ignorada ? "ignorada" : un ? "unidade_existente" : "nova",
          unidadeId: un?.id ?? null,
          imovelSugeridoId: un ? null : acharImovel(l.setor, l.endereco, secretariaSugerida, ex.imoveis),
          mesesComValor: comValor.length,
          mesesNovos: comValor.length - jaLancados,
          mesesJaLancados: jaLancados,
        };
      }),
    };
  });
}

// ------------------------------------------------------------------ gravação

export type DecisoesImportacao = {
  tipo: TipoUnidade;
  ano: number;
  vinculo: VinculoImovel;
  /** Por aba: "" (não importar), "novo" (criar secretaria com o nome da aba) ou o id de uma secretaria. */
  abas: Record<string, string>;
  /** Por linha (`aba#linha`): se entra e, para unidade nova, a que imóvel existente se liga (null = criar imóvel). */
  linhas: Record<string, { incluir: boolean; imovelId: string | null }>;
};

export type PlanoGravacao = {
  /** Nomes das secretarias a criar (nome da aba), sem repetir. */
  secretariasNovas: string[];
  imoveisNovos: { chave: string; secretaria: string; nome: string; endereco: string }[];
  unidadesNovas: { linha: string; codigo: string; imovel: { id: string } | { chaveNovo: string } }[];
  contas: { linha: string; unidadeId: string | null; referencia: string; valor: number }[];
  linhasImportadas: number;
  contasJaLancadas: number;
  avisos: string[];
};

/** `secretaria` de uma linha: id existente ou `novo:<aba>`. */
export function planejarGravacao(abas: AbaLida[], d: DecisoesImportacao, ex: Existentes): PlanoGravacao {
  const porCodigo = new Map(ex.unidades.filter((u) => u.tipo === d.tipo).map((u) => [chaveCodigo(u.numero), u]));
  const lancadas = new Set(ex.contas.map((c) => `${c.unidade_id}|${c.referencia}`));
  const idsImoveis = new Set(ex.imoveis.map((i) => i.id));
  const plano: PlanoGravacao = { secretariasNovas: [], imoveisNovos: [], unidadesNovas: [], contas: [], linhasImportadas: 0, contasJaLancadas: 0, avisos: [] };
  const imovelNovoPorChave = new Set<string>();
  const codigosVistos = new Set<string>();

  for (const a of abas) {
    const escolha = d.abas[a.nome] ?? "";
    if (escolha === "") continue;
    const secretaria = escolha === "novo" ? `novo:${a.nome}` : escolha;
    if (escolha === "novo" && !plano.secretariasNovas.includes(a.nome)) plano.secretariasNovas.push(a.nome);

    for (const l of a.linhas) {
      const dec = d.linhas[chaveLinha(l)];
      if (!dec?.incluir || l.ignorada) continue;
      const kc = chaveCodigo(l.codigo);
      if (codigosVistos.has(kc)) {
        plano.avisos.push(`Aba ${a.nome}, linha ${l.linhaNumero}: o código ${l.codigo} já apareceu antes na planilha; esta linha foi pulada.`);
        continue;
      }
      codigosVistos.add(kc);

      const existente = porCodigo.get(kc) ?? null;
      let unidadeId: string | null = existente?.id ?? null;
      if (!existente) {
        if (dec.imovelId && !idsImoveis.has(dec.imovelId)) {
          plano.avisos.push(`Aba ${a.nome}, linha ${l.linhaNumero}: o imóvel escolhido não existe mais; esta linha foi pulada.`);
          continue;
        }
        let destino: { id: string } | { chaveNovo: string };
        if (dec.imovelId) destino = { id: dec.imovelId };
        else {
          const chaveNovo = `${secretaria}|${chave(l.setor)}|${chave(l.endereco)}`;
          if (!imovelNovoPorChave.has(chaveNovo)) {
            imovelNovoPorChave.add(chaveNovo);
            plano.imoveisNovos.push({ chave: chaveNovo, secretaria, nome: l.setor, endereco: l.endereco.length >= 2 ? l.endereco : "Endereço não informado" });
          }
          destino = { chaveNovo };
        }
        plano.unidadesNovas.push({ linha: chaveLinha(l), codigo: l.codigo, imovel: destino });
      }
      l.valores.forEach((v, i) => {
        if (v === null || v < 0) return;
        const ref = referencia(d.ano, i + 1);
        if (unidadeId && lancadas.has(`${unidadeId}|${ref}`)) {
          plano.contasJaLancadas++;
          return;
        }
        plano.contas.push({ linha: chaveLinha(l), unidadeId, referencia: ref, valor: v });
      });
      unidadeId = null;
      plano.linhasImportadas++;
    }
  }
  return plano;
}
