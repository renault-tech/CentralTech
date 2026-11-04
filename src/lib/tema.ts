/**
 * Aparência (modo claro/escuro e estilo Apple/Clássico), por navegador, em localStorage — o MESMO esquema do Compras:
 * chave "tema" = "claro" | "escuro"; sem chave, vale o do sistema. O cálculo roda também num
 * script no <head> (`SCRIPT_TEMA_INICIAL`), antes da pintura, para a página não piscar.
 */
/** "apple" (padrão: vidro, azul da prefeitura) ou "classico" (visual anterior). */
export type Estilo = "apple" | "classico";
export type Modo = "auto" | "claro" | "escuro";

const CHAVE_MODO = "tema";
const CHAVE_ESTILO = "estilo";
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

export function lerEstilo(): Estilo {
  return ler(CHAVE_ESTILO) === "classico" ? "classico" : "apple";
}

export function modoEscuro(modo: Modo, sistemaEscuro: boolean): boolean {
  return modo === "escuro" || (modo === "auto" && sistemaEscuro);
}

/** Aplica o modo salvo ao <html>. */
export function aplicarTema(): void {
  const sistemaEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const el = document.documentElement;
  el.classList.toggle("dark", modoEscuro(lerModo(), sistemaEscuro));
  el.classList.toggle("estilo-apple", lerEstilo() === "apple");
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

/** Quem grava no banco (registrado pelo `SincronizarPreferencias`, só com sessão). */
let gravadorRemoto: ((p: { tema: Modo | null; estilo: Estilo | null }) => void) | null = null;
export function registrarGravadorRemoto(fn: typeof gravadorRemoto): void {
  gravadorRemoto = fn;
}

export function definirModo(modo: Modo): void {
  gravar(CHAVE_MODO, modo === "auto" ? null : modo);
  aplicarTema();
  gravadorRemoto?.({ tema: modo, estilo: null });
}

export function definirEstilo(estilo: Estilo): void {
  gravar(CHAVE_ESTILO, estilo === "classico" ? "classico" : null);
  aplicarTema();
  gravadorRemoto?.({ tema: null, estilo });
}

/** Aplica o que veio do banco (a pessoa trocou de computador/navegador), sem regravar no banco. */
export function aplicarDoServidor(p: { tema: Modo; estilo: Estilo }): void {
  gravar(CHAVE_MODO, p.tema === "auto" ? null : p.tema);
  gravar(CHAVE_ESTILO, p.estilo === "classico" ? "classico" : null);
  aplicarTema();
}

export function assinarTema(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO_TEMA, aoMudar);
  return () => window.removeEventListener(EVENTO_TEMA, aoMudar);
}

/** Script do <head>: mesma regra de `aplicarTema`, sem depender do bundle. */
export const SCRIPT_TEMA_INICIAL =
  "try{var d=document.documentElement,m=localStorage.getItem('tema'),e=localStorage.getItem('estilo');" +
  "if(m==='escuro'||(m!=='claro'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');" +
  "if(e!=='classico')d.classList.add('estilo-apple')}catch(x){document.documentElement.classList.add('estilo-apple')}";
