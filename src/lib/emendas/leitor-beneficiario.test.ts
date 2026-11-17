import { describe, expect, it } from "vitest";

import { lerBeneficiario } from "@/lib/emendas/leitor-beneficiario";

const CARTAO = `REPÚBLICA FEDERATIVA DO BRASIL
CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO
00.877.406/0001-57
MATRIZ
NOME EMPRESARIAL
CONSORCIO INTERMUNICIPAL DE SAUDE UNIAO DA MATA
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
CISUM
CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA
118-3 - Consórcio Público de Direito Público (Associação Pública)
LOGRADOURO
AV DOS EXPEDICIONARIOS
NÚMERO
S/N
COMPLEMENTO
********
CEP
36.700-000
BAIRRO/DISTRITO
BELA VISTA
MUNICÍPIO
LEOPOLDINA
UF
MG
ENDEREÇO ELETRÔNICO
contato@cisum.exemplo.org.br
TELEFONE
(32) 3441-1234
`;

const PLANO = `PLANO DE TRABALHO
2. IDENTIFICAÇÃO DA ORGANIZAÇÃO DA SOCIEDADE CIVIL - OSC
Razão Social: CONSELHO DE DESENV. COMUN. DO DISTRITO DE ARACATI
Nome Fantasia: -
CNPJ: 20.340.840/0001-00
Endereço Completo: RUA CAMILO DE ALMEIDA S/N
Telefone: (032) 99805-7526
E-mail: contato@aracati.exemplo.org
Representante Legal: FELIPE TOME OLIVEIRA
CPF do Representante Legal: 141.517.766-05`;

describe("lerBeneficiario", () => {
  it("lê o cartão do CNPJ de um consórcio e sugere a categoria pela natureza jurídica", () => {
    const { dados, avisos } = lerBeneficiario(CARTAO);
    expect(dados.cnpj).toBe("00.877.406/0001-57");
    expect(dados.nome).toBe("CONSORCIO INTERMUNICIPAL DE SAUDE UNIAO DA MATA");
    expect(dados.categoria).toBe("consorcio");
    expect(dados.categoriaMotivo).toMatch(/natureza jurídica/);
    expect(dados.endereco).toMatch(/AV DOS EXPEDICIONARIOS, S\/N/);
    expect(dados.endereco).toMatch(/BELA VISTA/);
    expect(dados.endereco).toMatch(/LEOPOLDINA\/MG/);
    expect(dados.endereco).toMatch(/CEP 36\.700-000/);
    expect(dados.endereco).not.toMatch(/\*\*\*/);
    expect(dados.email).toBe("contato@cisum.exemplo.org.br");
    expect(dados.telefone).toBe("(32) 3441-1234");
    expect(avisos).toEqual([]);
  });

  it("lê o plano de trabalho de uma OSC e nunca devolve CPF", () => {
    const { dados } = lerBeneficiario(PLANO);
    expect(dados.cnpj).toBe("20.340.840/0001-00");
    expect(dados.nome).toBe("CONSELHO DE DESENV. COMUN. DO DISTRITO DE ARACATI");
    expect(dados.representante).toBe("FELIPE TOME OLIVEIRA");
    expect(dados.telefone).toBe("(32) 99805-7526");
    expect(dados.email).toBe("contato@aracati.exemplo.org");
    expect(dados.categoria).toBe("osc");
    expect(JSON.stringify(dados)).not.toMatch(/141\.517|14151776/);
  });

  it("avisa o que não achou e ignora CNPJ inválido", () => {
    const { dados, avisos } = lerBeneficiario("Documento qualquer. CNPJ 11.111.111/1111-11. Nada mais.");
    expect(dados.cnpj).toBeUndefined();
    expect(avisos.join(" ")).toMatch(/CNPJ/);
    expect(avisos.join(" ")).toMatch(/razão social/);
    expect(avisos.join(" ")).toMatch(/categoria/);
  });

  it("ignora e-mail e telefone da Prefeitura", () => {
    const { dados } = lerBeneficiario("administracao@cataguases.mg.gov.br (32) 3422-1066 Razão Social: ASSOCIAÇÃO TESTE");
    expect(dados.email).toBeUndefined();
    expect(dados.telefone).toBeUndefined();
  });
});
