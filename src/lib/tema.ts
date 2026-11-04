/**
 * Modo de cor (claro/escuro), por navegador, em localStorage — o MESMO esquema do Compras:
 * chave "tema" = "claro" | "escuro"; sem chave, vale o do sistema. O cálculo roda também num
 * script no <head> (`SCRIPT_TEMA_INICIAL`), antes da pintura, para a página não piscar.
 */
export type Modo = "auto" | "claro" | "escuro";

const CHAVE_MODO = "tema";
export const EVENTO_TEMA = "tema-mudou";

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export function lerModo(): Modo {
  const v = ler(CHAVE_MODO);
  return v === "claro" || v === "escuro" ? v : "auto";
}

export function modoEscuro(modo: Modo, sistemaEscuro: boolean): boolean {
  return modo === "escuro" || (modo === "auto" && sistemaEscuro);
}

/** Aplica o modo salvo ao <html>. */
export function aplicarTema(): void {
  const sistemaEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", modoEscuro(lerModo(), sistemaEscuro));
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

export function definirModo(modo: Modo): void {
  gravar(CHAVE_MODO, modo === "auto" ? null : modo);
  aplicarTema();
}

export function assinarTema(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO_TEMA, aoMudar);
  return () => window.removeEventListener(EVENTO_TEMA, aoMudar);
}

/** Script do <head>: mesma regra de `aplicarTema`, sem depender do bundle. */
export const SCRIPT_TEMA_INICIAL =
  "try{var m=localStorage.getItem('tema');" +
  "if(m==='escuro'||(m!=='claro'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(x){}";
