/**
 * Página intermediária para links de e-mail de uso único.
 *
 * Antivírus e "prévia de link" de e-mail abrem a URL com um GET antes da
 * pessoa — se o GET já validasse o token (`verifyOtp`), ele seria gasto e o
 * clique de verdade cairia em "link inválido". Aqui o GET só mostra um botão;
 * quem valida o token é o POST do formulário, que nenhum scanner dispara.
 */

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlConfirmarLink(opcoes: {
  /** Caminho que recebe o POST (mesma origem). */
  acao: string;
  /** Campos escondidos reenviados no POST (token, tipo, destino…). */
  campos: Record<string, string>;
  titulo: string;
  texto: string;
  botao: string;
}): string {
  const inputs = Object.entries(opcoes.campos)
    .map(([nome, valor]) => `<input type="hidden" name="${escaparHtml(nome)}" value="${escaparHtml(valor)}">`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escaparHtml(opcoes.titulo)} · Central Cataguases</title>
<style>
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0c1d33}
  main{max-width:24rem;margin:1rem;padding:2rem 1.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:1rem;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{font-size:.9rem;line-height:1.5;color:#475569;margin:0 0 1.25rem}
  button{height:2.5rem;padding:0 1.25rem;border:0;border-radius:.5rem;background:#0c1d33;color:#fff;font-size:.9rem;font-weight:500;cursor:pointer}
  button:hover{opacity:.9}
</style>
</head>
<body>
<main>
  <h1>${escaparHtml(opcoes.titulo)}</h1>
  <p>${escaparHtml(opcoes.texto)}</p>
  <form method="post" action="${escaparHtml(opcoes.acao)}">${inputs}<button type="submit">${escaparHtml(opcoes.botao)}</button></form>
</main>
</body>
</html>`;
}

export function respostaHtml(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
