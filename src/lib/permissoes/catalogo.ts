/**
 * Catálogo de permissões por módulo (um lugar só). Cada módulo lista SÓ o que ele de fato confere:
 * uma permissão que nenhum código ou RLS do módulo lê não entra aqui (ligar um interruptor sem efeito engana).
 * Permissão nova de um módulo = uma entrada em `GRUPOS_COMPRAS` (e a checagem correspondente no módulo).
 */

export type PermissaoDef = {
  chave: string;
  rotulo: string;
  /** Frase curta sobre o que a pessoa passa a poder fazer. */
  ajuda: string;
  /** Só vale junto de outra (ex.: editar contratos exige ver contratos). */
  exige?: string;
  /** Perfis que já têm a permissão sem nenhuma linha avulsa. Linha `true` concede a outros; linha `false` retira destes. */
  padraoPerfis?: string[];
};

/** Valor efetivo de uma permissão: linha avulsa manda; sem linha, vale o padrão do perfil. */
export function permissaoEfetiva(item: PermissaoDef, perfil: string, ligadas: ReadonlySet<string>, retiradas: ReadonlySet<string>): boolean {
  if (ligadas.has(item.chave)) return true;
  if (retiradas.has(item.chave)) return false;
  return item.padraoPerfis?.includes(perfil) ?? false;
}

export type GrupoPermissoes = { id: string; titulo: string; itens: PermissaoDef[] };

/**
 * Conferido no repositório App-Compras (23/11/2026): só estas chaves são lidas pelo banco/RLS ou pelo app.
 * `criar_processos`, `editar_prazo` e as de Licitações foram ligadas ao banco e à tela em 23/11/2026. `distribuir`, `editar_fluxo` e `aprovar_prorrogacao` existem na matriz do Compras mas NADA as consulta
 * (as ações correspondentes dependem só do perfil), então não aparecem aqui até serem de fato aplicadas.
 */
export const GRUPOS_COMPRAS: GrupoPermissoes[] = [
  {
    id: "contratos",
    titulo: "Contratos",
    itens: [
      { chave: "contratos_ver", rotulo: "Ver contratos", ajuda: "Enxerga a lista e o detalhe dos contratos. O perfil sozinho não dá essa leitura." },
      { chave: "contratos_editar", rotulo: "Cadastrar e alterar contratos", ajuda: "Cria e edita contratos.", exige: "contratos_ver" },
    ],
  },
  {
    id: "processos",
    titulo: "Processos",
    itens: [
      {
        chave: "editar_prazo",
        rotulo: "Alterar prazos",
        ajuda: "Muda o prazo das atribuições em aberto do próprio setor. A coordenação do setor já pode pelo perfil; aqui dá para conceder a um servidor ou retirar de uma coordenação.",
        padraoPerfis: ["coord_compras", "coord_licitacoes", "coord_contratos"],
      },
      {
        chave: "criar_processos",
        rotulo: "Criar processos",
        ajuda: "Abre processos novos. Diretor e coordenação de Compras já podem pelo perfil; aqui dá para conceder a outra pessoa ou retirar de quem teria.",
        padraoPerfis: ["diretor", "coord_compras"],
      },
    ],
  },
  {
    id: "licitacoes",
    titulo: "Licitações",
    itens: [
      {
        chave: "licitacoes_atuar",
        rotulo: "Atuar em processos de Licitações",
        ajuda: "Movimenta processos que estão ou passaram por Licitações (devolver a Compras, confirmar recebimento, dar número). Desmarcar retira da coordenação ou do servidor.",
        padraoPerfis: ["coord_licitacoes", "serv_licitacoes"],
      },
      {
        chave: "licitacoes_apos_edital",
        rotulo: "Servidor atua depois da publicação do edital",
        ajuda: "Sem isto, o servidor de Licitações só age até a fase Publicação do edital. Vale só para servidor; a coordenação já não tem esse limite.",
        exige: "licitacoes_atuar",
      },
    ],
  },
  {
    id: "obras",
    titulo: "Obras e concorrência",
    itens: [{ chave: "obras_concorrencia_autonomia", rotulo: "Gerir obras e concorrência", ajuda: "Autonomia para conduzir obras e concorrências." }],
  },
  {
    id: "admin",
    titulo: "Administração",
    itens: [{ chave: "ver_logs", rotulo: "Ver registros de atividade", ajuda: "Acessa os logs do sistema." }],
  },
];

export type ModeloPermissoes = { id: string; nome: string; chaves: string[] };

/** Atalhos que ligam um conjunto de uma vez; depois dá para ajustar item a item. */
export const MODELOS_COMPRAS: ModeloPermissoes[] = [
  { id: "contratos_leitura", nome: "Contratos — só leitura", chaves: ["contratos_ver"] },
  { id: "contratos_gestao", nome: "Contratos — gestão", chaves: ["contratos_ver", "contratos_editar"] },
  { id: "nenhuma", nome: "Nenhuma permissão extra", chaves: [] },
];

export const CHAVES_COMPRAS: string[] = GRUPOS_COMPRAS.flatMap((g) => g.itens.map((i) => i.chave));

/** Aplica as dependências: ligar uma permissão liga o que ela exige; desligar uma desliga quem depende dela. */
export function normalizarPermissoes(ligadas: ReadonlySet<string>, grupos: GrupoPermissoes[] = GRUPOS_COMPRAS): Set<string> {
  const itens = grupos.flatMap((g) => g.itens);
  const r = new Set(ligadas);
  for (const i of itens) if (r.has(i.chave) && i.exige) r.add(i.exige);
  return r;
}

export function alternarPermissao(ligadas: ReadonlySet<string>, chave: string, ligar: boolean, grupos: GrupoPermissoes[] = GRUPOS_COMPRAS): Set<string> {
  const itens = grupos.flatMap((g) => g.itens);
  const r = new Set(ligadas);
  if (ligar) r.add(chave);
  else {
    r.delete(chave);
    for (const i of itens) if (i.exige === chave) r.delete(i.chave);
  }
  return normalizarPermissoes(r, grupos);
}
