/**
 * Cabeçalhos de segurança de toda resposta. A CSP é de propósito enxuta:
 * `script-src` fica de fora porque o Next injeta scripts inline sem nonce
 * (restringir quebraria a hidratação). Aqui entram só as diretivas que não
 * dependem disso: sem iframe (clickjacking nas telas de login, redefinir
 * senha e aprovar acesso), sem plugins, sem `<base>` trocado.
 * `Referrer-Policy` evita vazar por `Referer` os tokens que vão na URL
 * (`/auth/confirm?token_hash=`, `/primeiro-acesso?t=`).
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },
  experimental: {
    // Importação da planilha de emendas (Server Action com o .xlsx): o
    // limite padrão de 1 MB é apertado para uma planilha anual com
    // descrições longas.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
