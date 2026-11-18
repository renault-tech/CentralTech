/**
 * Gestor master: quem decide o encerramento das emendas, a abertura/fechamento de exercício e as importações de planilha.
 * Regra ÚNICA (um ponto só): administrador da Central sempre pode; se já existe algum master cadastrado, só ele (e o admin);
 * enquanto NÃO existe nenhum, os gestores seguem decidindo, para ninguém ficar sem acesso na transição.
 */
export function podeDecidirComoMaster(e: { adminHub: boolean; ehMaster: boolean; haMasters: boolean; gestor: boolean }): boolean {
  if (e.adminHub) return true;
  if (!e.gestor) return false;
  return e.haMasters ? e.ehMaster : true;
}
