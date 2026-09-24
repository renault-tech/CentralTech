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
    data: "2026-09-24",
    titulo: "Peça acesso pela Central Cataguases",
    descricao:
      "Nova página \"Solicitar acesso\", com um link direto na tela de login: preencha nome, e-mail e a quais sistemas você precisa (Compras, Numera, Requerimentos), e o administrador aprova cada um com a configuração certa (perfil e setor no Compras, perfil e secretaria no Requerimentos, nível e documentos no Numera). Se você já tem conta em algum sistema, o pedido só adiciona o que falta — nunca cria uma conta duplicada. Quando a conta é nova, você recebe um link de primeiro acesso para definir sua senha, sem depender de e-mail chegar.",
  },
  {
    data: "2026-09-22",
    titulo: "Navegação e tela de acessos melhoradas",
    descricao:
      "Toda tela do Hub (Início, Configurações, Novidades) agora tem o mesmo cabeçalho, com o brasão sempre levando à Início — antes, Configurações não tinha nenhum jeito de voltar sem usar o botão do navegador. A lista de usuários em Configurações também ficou mais clara: cada módulo virou uma coluna própria com um ícone colorido mostrando quem tem acesso a quê, em vez de rótulos de texto empilhados.",
  },
  {
    data: "2026-09-22",
    titulo: "A Central Cataguases chegou",
    descricao:
      "Um único lugar para acessar os sistemas da Prefeitura — hoje Compras/Licitações/Contratos, Numeração de Documentos e Requerimentos da Câmara. O login de cada sistema continua sendo o mesmo que você já usa: a Central só reúne os cards de acesso, sem trocar sua senha nem seus dados. Quem já tinha conta no Compras já entra aqui com o módulo liberado automaticamente; quem só tinha conta no Numera recebe acesso pelo administrador e define uma senha nova por \"Esqueci minha senha\" no primeiro acesso, já que o Numera usa um banco de dados separado.",
  },
];
