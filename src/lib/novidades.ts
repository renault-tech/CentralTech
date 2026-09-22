/**
 * Conteúdo vivo da página `/novidades` — módulo puro, editado no código a
 * cada mudança visível ao usuário no Hub (convenção fixada em
 * CLAUDE.md deste repositório: "toda mudança visível ganha uma entrada
 * aqui, no mesmo commit"). Mais recente primeiro.
 */

export type Novidade = {
  data: string; // AAAA-MM-DD
  titulo: string;
  descricao: string;
};

export const NOVIDADES: Novidade[] = [
  {
    data: "2026-09-22",
    titulo: "A Central Cataguases chegou",
    descricao:
      "Um único lugar para acessar os sistemas da Prefeitura — hoje Compras/Licitações/Contratos, Numeração de Documentos e Requerimentos da Câmara. O login de cada sistema continua sendo o mesmo que você já usa: a Central só reúne os cards de acesso, sem trocar sua senha nem seus dados. Quem já tinha conta no Compras já entra aqui com o módulo liberado automaticamente; quem só tinha conta no Numera recebe acesso pelo administrador e define uma senha nova por \"Esqueci minha senha\" no primeiro acesso, já que o Numera usa um banco de dados separado.",
  },
];
