/**
 * Cookie da preferência "barra lateral recolhida", um por módulo (lido no servidor para a página já abrir do jeito certo, sem piscar).
 * O de Emendas mantém o nome antigo para ninguém perder a escolha já feita.
 */
export const COOKIES_BARRA = {
  emendas: "emendas_barra",
  frotas: "frotas_barra",
  imoveis: "imoveis_barra",
} as const;

export type ModuloComBarra = keyof typeof COOKIES_BARRA;
