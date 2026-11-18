import { categoriaPelaNaturezaJuridica, type CategoriaBeneficiario } from "@/lib/emendas/categorias";
import { montarEndereco } from "@/lib/cep";

/**
 * Consulta de CNPJ na BrasilAPI (dados públicos da Receita Federal) para preencher o cadastro de entidades sem digitação.
 * Puro e testável: a rede entra por parâmetro (`buscar`). Sai do servidor (a tela chama uma server action), então não depende de CORS.
 * Só dados cadastrais públicos de pessoa jurídica; nenhum CPF é lido (o quadro de sócios devolve só o nome do representante).
 */

export type DadosCnpj = {
  cnpj: string;
  nome: string;
  endereco: string;
  email: string;
  telefone: string;
  /** Primeiro dirigente do quadro societário (uso interno; sem CPF). */
  representante: string;
  naturezaJuridica: string;
  categoria: CategoriaBeneficiario | null;
  situacao: string;
  ativa: boolean;
};

const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (x) => x.toLowerCase());

/** Natureza jurídica → categoria. Primeiro pelo texto (mesma regra da leitura de PDF); depois pelo grupo do código (1 público, 3 sem fins lucrativos). */
export function categoriaDaNatureza(descricao: string, codigo: unknown): CategoriaBeneficiario | null {
  if (/municipal/i.test(descricao) && /[óo]rg[ãa]o p[úu]blico|poder executivo|autarquia/i.test(descricao)) return "orgao_municipal";
  const porTexto = categoriaPelaNaturezaJuridica(descricao);
  if (porTexto) return porTexto;
  const c = String(codigo ?? "").replace(/\D/g, "");
  if (c.startsWith("3")) return "osc";
  if (c.startsWith("1")) return /municipal|munic[íi]pio/i.test(descricao) ? "orgao_municipal" : "ente_publico";
  return null;
}

export function interpretarBrasilApiCnpj(j: unknown): DadosCnpj | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const cnpj = txt(o.cnpj).replace(/\D/g, "");
  const nome = txt(o.razao_social) || txt(o.nome_fantasia);
  if (cnpj.length !== 14 || !nome) return null;
  const cep = txt(o.cep).replace(/\D/g, "");
  const logradouro = [txt(o.descricao_tipo_de_logradouro), txt(o.logradouro)].filter(Boolean).join(" ");
  const endereco = logradouro
    ? montarEndereco({
        logradouro: titulo(logradouro),
        numero: txt(o.numero) || undefined,
        complemento: txt(o.complemento) || undefined,
        bairro: titulo(txt(o.bairro)),
        cidade: titulo(txt(o.municipio)),
        uf: txt(o.uf),
        cep,
      })
    : "";
  const socios = Array.isArray(o.qsa) ? (o.qsa as Record<string, unknown>[]) : [];
  const natureza = txt(o.natureza_juridica);
  const situacao = txt(o.descricao_situacao_cadastral);
  return {
    cnpj,
    nome: titulo(nome),
    endereco,
    email: txt(o.email).toLowerCase(),
    telefone: txt(o.ddd_telefone_1),
    representante: titulo(txt(socios[0]?.nome_socio)),
    naturezaJuridica: natureza,
    categoria: categoriaDaNatureza(natureza, o.codigo_natureza_juridica),
    situacao,
    ativa: /^ativa$/i.test(situacao),
  };
}

export type ResultadoCnpj = { ok: true; dados: DadosCnpj } | { ok: false; motivo: "nao_encontrado" | "indisponivel" };

export async function buscarCnpj(cnpj14: string, buscar: typeof fetch, limiteMs = 6000): Promise<ResultadoCnpj> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), limiteMs);
  try {
    const r = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj14}`, { signal: ctrl.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (r.status === 404 || r.status === 400) return { ok: false, motivo: "nao_encontrado" };
    if (!r.ok) return { ok: false, motivo: "indisponivel" };
    const dados = interpretarBrasilApiCnpj(await r.json());
    return dados ? { ok: true, dados } : { ok: false, motivo: "nao_encontrado" };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  } finally {
    clearTimeout(t);
  }
}
