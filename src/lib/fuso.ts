/**
 * Fuso oficial da plataforma.
 *
 * O código roda em dois lugares com fusos diferentes: no navegador do
 * servidor público (já em Brasília) e na Vercel (UTC). Qualquer conta que
 * envolva "que dia é hoje" precisa fixar o fuso explicitamente, senão o
 * mesmo dado aparece diferente no painel (renderizado no servidor) e na
 * lista (renderizada no cliente) — e, entre 21h e 00h, o servidor já virou
 * o dia enquanto o usuário ainda está no dia anterior.
 *
 * Módulo puro (sem React, sem rede) para poder ser usado pelas duas pontas
 * e testado direto.
 */

export const FUSO_PLATAFORMA = "America/Sao_Paulo";

// `en-CA` formata como AAAA-MM-DD, que é exatamente o formato de data-only
// que precisamos para comparar dias.
const FORMATADOR_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_PLATAFORMA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Data-calendário (AAAA-MM-DD) daquele instante **no fuso de Cataguases**,
 * independente de onde o código está rodando.
 */
export function dataNoFuso(data: Date): string {
  return FORMATADOR_DATA.format(data);
}

/**
 * Diferença em dias de calendário entre dois instantes, contados no fuso da
 * plataforma. Positivo quando `fim` é posterior.
 *
 * Converte cada instante para a sua data-calendário local e só então
 * subtrai — assim "ontem 23h" e "hoje 01h" distam 1 dia, e não 0.
 */
export function diasDeCalendarioEntre(inicio: Date, fim: Date): number {
  const a = Date.parse(`${dataNoFuso(inicio)}T00:00:00Z`);
  const b = Date.parse(`${dataNoFuso(fim)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Offset do fuso naquele instante, no formato `-03:00`. */
function offsetDoFuso(instante: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_PLATAFORMA,
    timeZoneName: "longOffset",
  }).formatToParts(instante);

  const nome = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00";
  // "GMT-03:00" → "-03:00"; "GMT" (offset zero) → "+00:00".
  const offset = nome.replace("GMT", "");
  return offset === "" ? "+00:00" : offset;
}

/**
 * Primeiro instante do dia `AAAA-MM-DD` no fuso da plataforma, como string
 * ISO **com offset** — pronta para comparar com uma coluna `timestamptz`.
 *
 * Sem o offset, o Postgres interpreta a string como UTC: "26/07 00:00" vira
 * 21h do dia 25 em Brasília, e o filtro passa a incluir/excluir as horas
 * erradas.
 */
export function inicioDoDiaNoFuso(dataISO: string): string {
  return `${dataISO}T00:00:00.000${offsetDoFuso(referencia(dataISO))}`;
}

/** Último instante do dia `AAAA-MM-DD` no fuso da plataforma (ver acima). */
export function fimDoDiaNoFuso(dataISO: string): string {
  return `${dataISO}T23:59:59.999${offsetDoFuso(referencia(dataISO))}`;
}

/**
 * Instante de referência para descobrir o offset vigente naquela data.
 * Meio-dia UTC nunca cai no meio de uma transição de horário de verão,
 * então o offset lido é sempre o do dia pretendido.
 */
function referencia(dataISO: string): Date {
  return new Date(`${dataISO}T12:00:00Z`);
}
