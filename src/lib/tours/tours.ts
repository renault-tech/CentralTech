/**
 * Registro dos tours guiados do Hub — mesmo mecanismo já usado no
 * App-Compras (Bloco 5 do punch list de lá), portado para este repo.
 * Módulo puro (sem DOM/driver.js), para não puxar a biblioteca de tour
 * só por importar a lista.
 */

export type PassoTour = {
  seletor: string;
  titulo: string;
  descricao: string;
  lado?: "top" | "right" | "bottom" | "left";
};

export type Tour = {
  id: string;
  nome: string;
  descricao: string;
  /** Rota onde este tour roda. Vazio = disponível em qualquer tela. */
  rota: string;
  passos: PassoTour[];
};

export const TOURS: Tour[] = [
  {
    id: "boas-vindas-hub",
    nome: "Boas-vindas",
    descricao: "O que é a Central Cataguases e como o acesso aos módulos funciona",
    rota: "",
    passos: [
      {
        seletor: '[data-tour="marca-hub"]',
        titulo: "Central Cataguases",
        descricao:
          "Um único lugar para acessar os sistemas da Prefeitura. O login continua sendo o mesmo que você já usa em cada um deles.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="cards-modulos"]',
        titulo: "Seus módulos",
        descricao:
          "Cada card leva ao sistema real, na conta que você já tem lá. Só aparecem aqui os módulos liberados para você — se faltar algum, peça ao administrador.",
        lado: "top",
      },
      {
        seletor: '[data-tour="link-novidades"]',
        titulo: "Novidades",
        descricao: "Acompanhe por aqui o que muda na plataforma, com data de cada atualização.",
        lado: "bottom",
      },
      {
        seletor: '[data-tour="botao-ajuda"]',
        titulo: "Precisa rever isso?",
        descricao: "Clique aqui a qualquer momento para repetir este tour.",
        lado: "bottom",
      },
    ],
  },
];

/** Tour cuja rota é prefixo exato do pathname atual (a rota vazia do boas-vindas nunca "casa" aqui). */
export function tourPorRota(pathname: string): Tour | undefined {
  return TOURS.filter((t) => t.rota && pathname.startsWith(t.rota)).sort(
    (a, b) => b.rota.length - a.rota.length
  )[0];
}

export function tourPorId(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}
