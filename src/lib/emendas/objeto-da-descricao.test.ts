import { describe, expect, it } from "vitest";

import { objetoDaDescricao } from "@/lib/emendas/objeto-da-descricao";

describe("objetoDaDescricao", () => {
  it("monta o objeto a partir da descrição da planilha", () => {
    expect(objetoDaDescricao("Reforço da dotação orçamentária para a Casa da Criança, situada na Rua Vanda, 151, Bairro Bela Vista, cujo intuito será a aquisição de brinquedos, conforme demanda a ser apresentada pelo responsável, essenciais para..."))
      .toBe("Reforço da dotação da Casa da Criança para aquisição de brinquedos");
    expect(objetoDaDescricao("Reforço da dotação orçamentária para a Secretaria Municipal de Esportes, cujo intuito será de aquisição de materiais esportivos, conforme demanda a ser apresentada pelo secretário, como forma de subsidiar."))
      .toBe("Reforço da dotação da Secretaria Municipal de Esportes para aquisição de materiais esportivos");
    expect(objetoDaDescricao("Reforço da dotação orçamentária para a Associação de Moradores do Bairro X, CNPJ 36.416.936/0001-45, situada na Rua W, 157, Bairro Fátima, cujo intuito será de custeio para reforma do banheiro e cozinha da associação na sua sede, proporcionando um lugar."))
      .toBe("Reforço da dotação da Associação de Moradores do Bairro X para custeio para reforma do banheiro e cozinha da associação na sua sede");
  });
  it("sem finalidade na descrição, devolve null", () => {
    expect(objetoDaDescricao("")).toBeNull();
    expect(objetoDaDescricao("Texto qualquer")).toBeNull();
  });
});
