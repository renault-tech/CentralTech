/**
 * Leitura (heurística) do TEXTO de um documento para cadastrar um beneficiário: cartão do CNPJ, estatuto, plano de trabalho,
 * ofício. Nada aqui grava e o PDF nunca é guardado: a tela só preenche o formulário com o que foi achado e a pessoa confere.
 * Só propõe o que achou (nunca inventa); o que não achou vira aviso. CPF não é lido (nem do representante).
 * Calibrado com textos de exemplo: **ajustar com os primeiros documentos reais**. Função pura, testada.
 */

import { categoriaPelaNaturezaJuridica, type CategoriaBeneficiario } from "@/lib/emendas/categorias";
import { formatarCnpj } from "@/lib/emendas/documentos";
import { cnpjValido } from "@/lib/emendas/portal-verificacao";

export type BeneficiarioLido = {
  nome?: string;
  cnpj?: string;
  endereco?: string;
  email?: string;
  telefone?: string;
  representante?: string;
  categoria?: CategoriaBeneficiario;
  /** De onde a categoria foi deduzida (para a pessoa saber o motivo). */
  categoriaMotivo?: string;
};

const limpar = (t: string) => t.replace(/\s+/g, " ").trim();
const ROTULOS_FIM =
  "NOME FANTASIA|T[ÍI]TULO DO ESTABELECIMENTO|PORTE|C[ÓO]DIGO E DESCRI[ÇC][ÃA]O|LOGRADOURO|N[ÚU]MERO|COMPLEMENTO|CEP|BAIRRO|MUNIC[ÍI]PIO|UF|ENDERE[ÇC]O ELETR[ÔO]NICO|TELEFONE|CNPJ|E-?MAIL|REPRESENTANTE|PRESIDENTE|CPF|RG|RAZ[ÃA]O SOCIAL|NOME EMPRESARIAL|DATA DA|SITUA[ÇC][ÃA]O|ENDERE[ÇC]O";

/** Valor que vem depois de um rótulo, até o próximo rótulo conhecido ou quebra de linha dupla. */
function depoisDe(texto: string, rotulos: string): string | undefined {
  const re = new RegExp(`(?:${rotulos})\\s*[:\\-]?\\s*\\n?\\s*([^\\n]+?)(?=\\s*(?:\\n|\\b(?:${ROTULOS_FIM})\\b\\s*[:\\n]|$))`, "i");
  const m = re.exec(texto);
  const v = m ? limpar(m[1]) : "";
  return v && v.length >= 2 && v.length <= 200 ? v : undefined;
}

function acharCnpj(texto: string, avisos: string[]): string | undefined {
  const brutos = texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) ?? [];
  const validos = [...new Set(brutos.map((b) => b.replace(/\D/g, "")).filter((d) => d.length === 14 && cnpjValido(d)))];
  if (validos.length === 0) return undefined;
  if (validos.length > 1) {
    const perto = /(?:CNPJ|INSCRI[ÇC][ÃA]O)[^\d]{0,40}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i.exec(texto);
    const d = perto?.[1].replace(/\D/g, "");
    avisos.push("O documento traz mais de um CNPJ válido: confira se este é o da entidade.");
    if (d && validos.includes(d)) return formatarCnpj(d);
  }
  return formatarCnpj(validos[0]);
}

/** Valor na linha seguinte a um rótulo que está SOZINHO na linha (layout do cartão do CNPJ). */
function aposRotuloIsolado(texto: string, rotulo: string): string | undefined {
  const m = new RegExp(`^[ \\t]*(?:${rotulo})[ \\t]*$\\n[ \\t]*([^\\n]+)$`, "im").exec(texto);
  const v = m ? limpar(m[1]) : "";
  return v && v.length <= 200 ? v : undefined;
}

function acharEndereco(texto: string): string | undefined {
  // Layout do cartão do CNPJ: LOGRADOURO / NÚMERO / COMPLEMENTO / CEP / BAIRRO / MUNICÍPIO / UF
  const campo = (r: string) => aposRotuloIsolado(texto, r);
  const logradouro = campo("LOGRADOURO");
  if (logradouro) {
    const numero = campo("N[ÚU]MERO");
    const compl = campo("COMPLEMENTO");
    const cep = aposRotuloIsolado(texto, "CEP")?.match(/\d{2}\.?\d{3}-?\d{3}/)?.[0];
    const bairro = campo("BAIRRO(?:\\/DISTRITO)?");
    const cidade = campo("MUNIC[ÍI]PIO");
    const uf = aposRotuloIsolado(texto, "UF")?.match(/^[A-Z]{2}$/)?.[0];
    const rua = [logradouro, numero && !/^\*+$/.test(numero) ? numero : null].filter(Boolean).join(", ");
    const partes = [rua, compl && !/^\*+$/.test(compl) ? compl : null, bairro, cidade ? `${cidade}${uf ? `/${uf}` : ""}` : null, cep ? `CEP ${cep}` : null].filter(Boolean);
    return partes.length >= 2 ? (partes as string[]).join(" - ") : undefined;
  }
  return depoisDe(texto, "Endere[çc]o(?: completo| da sede| sede)?");
}

function acharEmail(texto: string): string | undefined {
  const todos = texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  const externos = todos.filter((e) => !/@cataguases\.mg\.gov\.br$/i.test(e) && !/@(?:exemplo|example)\./i.test(e));
  if (externos.length === 0) return undefined;
  const rotulado = /(?:E-?MAIL|ENDERE[ÇC]O ELETR[ÔO]NICO)\s*[:\-]?\s*\n?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i.exec(texto)?.[1];
  return (rotulado ?? externos[0]).toLowerCase();
}

function acharTelefone(texto: string): string | undefined {
  const rot = /TELEFONE\s*[:\-]?\s*\n?\s*([\d ()\-.\/]{8,30})/i.exec(texto)?.[1];
  const base = rot ?? /\(?\b0?\d{2}\)?\s?9?\d{4}[-\s]\d{4}\b/.exec(texto)?.[0];
  if (!base) return undefined;
  const d = base.replace(/\D/g, "").replace(/^0/, "");
  if (d.length < 10 || d.length > 11) return undefined;
  if (/3422-?1066/.test(base)) return undefined; // telefone da Prefeitura
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

function acharRepresentante(texto: string): string | undefined {
  const m = /(?:Representante legal|Presidente|Respons[áa]vel legal|Diretor(?:a)?(?:-presidente)?)\s*[:\-]?\s*\n?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç' ]{4,70}?)(?=\s*(?:[,.;\n]|CPF|RG|\bCargo\b|$))/i.exec(texto);
  const v = m ? limpar(m[1]) : "";
  return v && v.split(" ").length >= 2 ? v : undefined;
}

export function lerBeneficiario(texto: string): { dados: BeneficiarioLido; avisos: string[] } {
  const avisos: string[] = [];
  const dados: BeneficiarioLido = {};
  const t = texto.replace(/\r/g, "");

  dados.cnpj = acharCnpj(t, avisos);
  dados.nome = depoisDe(t, "NOME EMPRESARIAL|Raz[ãa]o Social|Nome da (?:entidade|institui[çc][ãa]o|organiza[çc][ãa]o)|Proponente|Nome da OSC");
  dados.endereco = acharEndereco(t);
  dados.email = acharEmail(t);
  dados.telefone = acharTelefone(t);
  dados.representante = acharRepresentante(t);

  const natureza = depoisDe(t, "C[ÓO]DIGO E DESCRI[ÇC][ÃA]O DA NATUREZA JUR[ÍI]DICA|NATUREZA JUR[ÍI]DICA");
  const porNatureza = natureza ? categoriaPelaNaturezaJuridica(natureza) : null;
  const porNome = dados.nome ? categoriaPelaNaturezaJuridica(dados.nome) : null;
  const categoria = porNatureza ?? porNome;
  if (categoria) {
    dados.categoria = categoria;
    dados.categoriaMotivo = porNatureza ? `natureza jurídica: ${natureza}` : `nome: ${dados.nome}`;
  }

  if (!dados.cnpj) avisos.push("Não achei um CNPJ válido no documento: digite o CNPJ.");
  if (!dados.nome) avisos.push("Não achei a razão social: digite o nome.");
  if (!dados.categoria) avisos.push("Não deu para deduzir a categoria pelo documento: escolha a categoria.");
  return { dados, avisos };
}
