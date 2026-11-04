import "server-only";

import {
  listarFornecedores,
  listarManutencoes,
  listarNotas,
  listarSecretarias,
  listarVeiculos,
  obterParametros,
} from "@/lib/frotas/dados";
import { filtrarManutencoes, filtrarNotas, filtrarVeiculos, lerFiltroManutencao, lerFiltroNotas, lerFiltroVeiculos } from "@/lib/frotas/filtros";
import {
  ROTULO_RELATORIO,
  relatorioCombustivel,
  relatorioCompleto,
  relatorioContabilidade,
  relatorioCusto,
  relatorioGastoSecretaria,
  relatorioManutencoes,
  relatorioPendencias,
  relatorioVeiculos,
  type DadosRelatorio,
  type IdRelatorio,
  type Tabela,
} from "@/lib/frotas/relatorios";
import { revisarVeiculos } from "@/lib/frotas/revisao";
import { dataNoFuso } from "@/lib/fuso";

type Parametros = Record<string, string | string[] | undefined>;

/** Monta o relatório pedido, sob a RLS de quem pede. Os filtros da tela (mesmos parâmetros da URL) valem para veículos, NFs e manutenções. */
export async function montarRelatorio(
  id: IdRelatorio | "completo",
  sp: Parametros
): Promise<{ nome: string; hoje: string; tabelas: Tabela[]; filtrado: boolean }> {
  const [veiculos, manutencoes, notas, secretarias, fornecedores, params] = await Promise.all([
    listarVeiculos(),
    listarManutencoes(),
    listarNotas(),
    listarSecretarias(),
    listarFornecedores(),
    obterParametros(),
  ]);
  const hoje = dataNoFuso(new Date());
  const dados: DadosRelatorio = { hoje, veiculos, manutencoes, notas, secretarias, fornecedores, params };
  const avisos = revisarVeiculos(veiculos);
  const nomeSecretaria = new Map(secretarias.map((s) => [s.id, s.nome]));
  const nomeFornecedor = new Map(fornecedores.map((f) => [f.id, f.nome]));

  switch (id) {
    case "veiculos": {
      const f = lerFiltroVeiculos(sp);
      const lista = filtrarVeiculos(veiculos, f, new Set(avisos.keys()));
      return { nome: ROTULO_RELATORIO.veiculos, hoje, tabelas: relatorioVeiculos(dados, lista, avisos), filtrado: lista.length !== veiculos.length };
    }
    case "combustivel": {
      const f = lerFiltroNotas(sp);
      const lista = filtrarNotas(notas, f, hoje, { secretarias: nomeSecretaria, fornecedores: nomeFornecedor });
      return { nome: ROTULO_RELATORIO.combustivel, hoje, tabelas: relatorioCombustivel(dados, lista), filtrado: lista.length !== notas.length };
    }
    case "manutencoes": {
      const f = lerFiltroManutencao(sp);
      const lista = filtrarManutencoes(manutencoes, f, { veiculos: new Map(veiculos.map((v) => [v.id, v])), secretarias: nomeSecretaria });
      return { nome: ROTULO_RELATORIO.manutencoes, hoje, tabelas: relatorioManutencoes(dados, lista), filtrado: lista.length !== manutencoes.length };
    }
    case "custo":
      return { nome: ROTULO_RELATORIO.custo, hoje, tabelas: relatorioCusto(dados), filtrado: false };
    case "gasto-secretaria":
      return { nome: ROTULO_RELATORIO["gasto-secretaria"], hoje, tabelas: relatorioGastoSecretaria(dados), filtrado: false };
    case "contabilidade":
      return { nome: ROTULO_RELATORIO.contabilidade, hoje, tabelas: relatorioContabilidade(dados), filtrado: false };
    case "pendencias":
      return { nome: ROTULO_RELATORIO.pendencias, hoje, tabelas: relatorioPendencias(dados), filtrado: false };
    case "completo":
      return { nome: "Frotas completo", hoje, tabelas: relatorioCompleto(dados, avisos), filtrado: false };
  }
}
