import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra simétrica (AES-256-GCM) para guardar a autorização do Drive no banco. Puro: a chave entra por parâmetro, para
 * testar sem ambiente. O formato é `v1.<iv>.<etiqueta>.<texto>` em base64url, então dá para trocar o algoritmo depois.
 */
function chaveDe(segredo: string): Buffer {
  if (segredo.length < 16) throw new Error("A chave de cifra dos documentos é curta demais.");
  return createHash("sha256").update(segredo).digest();
}

export function cifrar(texto: string, segredo: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDe(segredo), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), dados.toString("base64url")].join(".");
}

export function decifrar(cifrado: string, segredo: string): string {
  const [versao, iv, etiqueta, dados] = cifrado.split(".");
  if (versao !== "v1" || !iv || !etiqueta || !dados) throw new Error("Formato de dado cifrado desconhecido.");
  const d = createDecipheriv("aes-256-gcm", chaveDe(segredo), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([d.update(Buffer.from(dados, "base64url")), d.final()]).toString("utf8");
}
