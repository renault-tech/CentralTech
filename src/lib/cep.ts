/**
 * CEP → endereço (funções puras; a chamada de rede recebe o `fetch` por parâmetro para ser testada sem internet).
 * Fonte principal: ViaCEP; reserva: BrasilAPI. A consulta roda no SERVIDOR (`cep-actions.ts`): não depende de CORS nem da CSP do
 * navegador e o endpoint fica atrás do login e de um limite por IP.
 */

export type EnderecoCep = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string };

/** "36.770-000", "36770000" → "36770000"; qualquer outra coisa → null. */
export function normalizarCep(texto: string): string | null {
  const d = texto.replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

/** Máscara enquanto digita: "36770" → "36770", "36770000" → "36770-000". */
export function mascararCep(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function interpretarViaCep(j: unknown): EnderecoCep | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  if (o.erro === true || o.erro === "true") return null;
  const cep = normalizarCep(txt(o.cep));
  if (!cep || !txt(o.localidade)) return null;
  return { cep, logradouro: txt(o.logradouro), bairro: txt(o.bairro), cidade: txt(o.localidade), uf: txt(o.uf).toUpperCase() };
}

export function interpretarBrasilApi(j: unknown): EnderecoCep | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const cep = normalizarCep(txt(o.cep));
  if (!cep || !txt(o.city)) return null;
  return { cep, logradouro: txt(o.street), bairro: txt(o.neighborhood), cidade: txt(o.city), uf: txt(o.state).toUpperCase() };
}

export type ResultadoCep = { ok: true; endereco: EnderecoCep } | { ok: false; motivo: "invalido" | "nao_encontrado" | "indisponivel" };

type Fonte = { url: (cep: string) => string; interpretar: (j: unknown) => EnderecoCep | null };
const FONTES: Fonte[] = [
  { url: (c) => `https://viacep.com.br/ws/${c}/json/`, interpretar: interpretarViaCep },
  { url: (c) => `https://brasilapi.com.br/api/cep/v2/${c}`, interpretar: interpretarBrasilApi },
];

/** Consulta as fontes em ordem. "Não encontrado" só vale se NENHUMA fonte achou; falha de rede em todas = indisponível. */
export async function buscarCep(cepBruto: string, buscar: typeof fetch, limiteMs = 4000): Promise<ResultadoCep> {
  const cep = normalizarCep(cepBruto);
  if (!cep) return { ok: false, motivo: "invalido" };
  let algumaRespondeu = false;
  for (const f of FONTES) {
    try {
      const r = await buscar(f.url(cep), { signal: AbortSignal.timeout(limiteMs), headers: { Accept: "application/json" }, cache: "no-store" });
      if (r.status === 404 || r.status === 400) {
        algumaRespondeu = true;
        continue;
      }
      if (!r.ok) continue;
      algumaRespondeu = true;
      const e = f.interpretar(await r.json());
      if (e) return { ok: true, endereco: e };
    } catch {
      // timeout, rede ou JSON inválido: tenta a próxima fonte
    }
  }
  return { ok: false, motivo: algumaRespondeu ? "nao_encontrado" : "indisponivel" };
}

export type PartesEndereco = { logradouro: string; numero?: string; complemento?: string; bairro: string; cidade: string; uf: string; cep: string };

/** "Rua Major Vieira, 412, sala 3 - Centro - Cataguases/MG - CEP 36770-000" (omite o que estiver vazio). */
export function montarEndereco(p: PartesEndereco): string {
  const rua = [p.logradouro, p.numero?.trim(), p.complemento?.trim()].filter(Boolean).join(", ");
  const cidade = [p.cidade, p.uf].filter(Boolean).join("/");
  const cep = normalizarCep(p.cep);
  return [rua, p.bairro, cidade, cep ? `CEP ${mascararCep(cep)}` : ""].filter(Boolean).join(" - ");
}

/** Acha um "CEP 36770-000" (ou só o número) num endereço já gravado, para preencher o campo ao editar. */
export function cepDoEndereco(endereco: string): string {
  const m = endereco.match(/CEP\s*(\d{5}-?\d{3})/i);
  return m ? mascararCep(m[1]) : "";
}
