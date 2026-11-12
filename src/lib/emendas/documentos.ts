import { cnpjValido } from "@/lib/emendas/portal-verificacao";

export type TipoBeneficiario = "entidade" | "orgao_publico" | "pessoa_fisica";

export const NOME_TIPO_BENEFICIARIO: Record<TipoBeneficiario, string> = {
  entidade: "Entidade",
  orgao_publico: "Órgão público",
  pessoa_fisica: "Pessoa física",
};

export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    const s = d.slice(0, n).split("").reduce((a, c, i) => a + Number(c) * (n + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export const formatarCnpj = (d: string) => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
export const formatarCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;

/** Valida o documento exigido pelo tipo (CNPJ para entidade/órgão, CPF para pessoa física). */
export function validarDocumento(tipo: TipoBeneficiario, bruto: string | null | undefined): { ok: true; cnpj: string | null; cpf: string | null } | { ok: false; erro: string } {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (tipo === "pessoa_fisica") {
    if (!d) return { ok: false, erro: "Pessoa física precisa de CPF." };
    if (!cpfValido(d)) return { ok: false, erro: "CPF inválido (confira os dígitos)." };
    return { ok: true, cnpj: null, cpf: formatarCpf(d) };
  }
  if (!d && tipo === "orgao_publico") return { ok: true, cnpj: null, cpf: null }; // órgão da prefeitura: vale o CNPJ do Município
  if (!d) return { ok: false, erro: "Entidade precisa de CNPJ." };
  if (!cnpjValido(d)) return { ok: false, erro: "CNPJ inválido (confira os dígitos)." };
  return { ok: true, cnpj: formatarCnpj(d), cpf: null };
}

/** Dados que o texto da emenda já traz e que não devem ser pedidos de novo em outro lugar. */
export function extrairDaDescricao(descricao: string): { cnpj: string | null; localidade: string | null } {
  const cnpjs = [...new Set((descricao.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) ?? []).filter(cnpjValido))];
  const m = descricao.match(/situad[oa]\s+(?:na|no|à|em|nesta|neste)\s+([\s\S]*)/i);
  let localidade: string | null = null;
  if (m) {
    const t = m[1]
      .replace(/\b(Dr|Dra|Av|Prof|Profa|Cel|Pe|Pça)\.\s/g, "$1§ ")
      .replace(/((,|\s)\s*(cujo|cuja|conforme|a ser|para|com |que |onde|tendo|visando|objetivando|de forma|sendo|necess|destinad)|\.\s+[A-ZÁÉÍÓÚ])[\s\S]*$/, "")
      .replace(/§/g, ".")
      .replace(/^[\s.,;]+|[\s.,;]+$/g, "");
    if (t.length >= 8 && t.length <= 110) localidade = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return { cnpj: cnpjs.length === 1 ? formatarCnpj(cnpjs[0].replace(/\D/g, "")) : null, localidade };
}
