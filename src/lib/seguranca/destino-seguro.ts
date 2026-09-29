/**
 * Impede open redirect (CWE-601). Achado de auditoria de segurança: o filtro
 * ingênuo `valor.startsWith("/") && !valor.startsWith("//")` não barra
 * `/\evil.com` — o parser de URL (WHATWG, usado tanto pelo `new URL()`
 * quanto pela resolução do header `Location` no navegador) normaliza `\`
 * para `/` em esquemas especiais, então `/\evil.com` vira `//evil.com` →
 * autoridade `evil.com`. Confirmado ao vivo (`new URL("/\\evil.com", base)`
 * resolve para `https://evil.com/`). Esta função resolve o valor com o
 * MESMO parser que vai processar o redirect de verdade, e só aceita quando
 * a origem resultante não muda — não dá pra bypassar com nenhuma variação
 * de string que o navegador entenda diferente. `http://localhost` é só uma
 * base fixa e arbitrária pra checar "isto é um caminho relativo, não um
 * redirect pra outro host" — nunca é a origem real da requisição, então a
 * mesma função serve tanto pra caminhos dentro do Hub quanto, mais tarde,
 * ao serem prefixados com a URL de outro app (SSO), sem precisar saber qual
 * é a origem de verdade em cada chamada.
 *
 * Extraída para cá porque a versão original (`/auth/confirm/route.ts`)
 * corrigiu o open redirect só ali — `entrar()` (`src/lib/actions/auth.ts`)
 * tinha o MESMO filtro ingênuo e ficou de fora daquela auditoria, achado ao
 * construir o SSO silencioso (que precisa da mesma validação num terceiro
 * lugar) e corrigido de carona.
 */
export function destinoSeguro(valor: string | null | undefined, fallback: string): string {
  if (!valor) return fallback;
  try {
    const base = "http://localhost";
    const resolvido = new URL(valor, base);
    if (resolvido.origin !== base) return fallback;
    return resolvido.pathname + resolvido.search + resolvido.hash;
  } catch {
    return fallback;
  }
}
