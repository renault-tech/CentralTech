/**
 * Zoom (tamanho do texto) da plataforma, por navegador, em localStorage (chave "zoom"). Não vai para o banco, de
 * propósito: o tamanho certo depende da tela de cada aparelho (um monitor grande e um celular pedem valores diferentes).
 *
 * Como funciona: muda o tamanho da fonte raiz do `<html>` em PORCENTAGEM (100% = a fonte padrão do navegador, então
 * quem já aumentou a fonte no navegador continua partindo do seu tamanho). Todo o texto e os espaços do app são em
 * `rem`, então tudo acompanha; os tamanhos de letra que antes eram fixos em `px` foram convertidos para `rem`.
 *
 * "Inteligente": o zoom guardado é a PREFERÊNCIA; o que vale em cada momento é limitado pela largura da tela
 * (`limiteDoZoom`), para o conteúdo nunca ficar espremido demais. Girar o celular ou redimensionar a janela reaplica o
 * limite sem perder a preferência. O cálculo roda também num script no `<head>` (`SCRIPT_ZOOM_INICIAL`), antes da
 * pintura, para a página não "pular" de tamanho.
 */

export const PASSOS_ZOOM = [100, 110, 125, 150, 175, 200] as const;
export const CHAVE_ZOOM = "zoom";
export const EVENTO_ZOOM = "zoom-mudou";
/** Largura mínima, em px de CSS, que o conteúdo ainda precisa ter depois de aumentar o texto. */
export const LARGURA_MINIMA_UTIL = 280;

/** Aceita só os passos oferecidos; qualquer outra coisa (vazio, lixo, valor antigo) vira 100. */
export function normalizarZoom(valor: unknown): number {
  const n = typeof valor === "number" ? valor : parseInt(String(valor ?? ""), 10);
  return (PASSOS_ZOOM as readonly number[]).includes(n) ? n : 100;
}

/** Maior passo que ainda deixa `LARGURA_MINIMA_UTIL` de largura útil (nunca menos que 100). */
export function limiteDoZoom(larguraTela: number): number {
  let limite = 100;
  for (const p of PASSOS_ZOOM) if ((larguraTela * 100) / p >= LARGURA_MINIMA_UTIL) limite = p;
  return limite;
}

/** O zoom que realmente vale: a preferência, limitada pela tela. */
export function zoomAplicado(preferido: unknown, larguraTela: number): number {
  return Math.min(normalizarZoom(preferido), limiteDoZoom(larguraTela));
}

/** Passo seguinte (+1) ou anterior (-1), sem passar de 100 nem do limite. */
export function passoVizinho(atual: number, direcao: 1 | -1, limite: number): number {
  const i = PASSOS_ZOOM.indexOf(normalizarZoom(atual) as (typeof PASSOS_ZOOM)[number]);
  const novo = PASSOS_ZOOM[Math.min(PASSOS_ZOOM.length - 1, Math.max(0, i + direcao))];
  return Math.min(novo, Math.max(100, limite));
}

// ----------------------------------------------------------------------------- navegador

function ler(): string | null {
  try {
    return localStorage.getItem(CHAVE_ZOOM);
  } catch {
    return null;
  }
}

/** Zoom guardado (a preferência), sem o limite da tela. */
export function lerZoom(): number {
  return normalizarZoom(ler());
}

/** Aplica o zoom ao `<html>`: preferência guardada, limitada pela largura atual. */
export function aplicarZoom(): number {
  const z = zoomAplicado(ler(), window.innerWidth);
  const el = document.documentElement;
  if (z === 100) el.style.removeProperty("font-size");
  else el.style.fontSize = `${z}%`;
  window.dispatchEvent(new Event(EVENTO_ZOOM));
  return z;
}

export function definirZoom(valor: number): void {
  try {
    if (normalizarZoom(valor) === 100) localStorage.removeItem(CHAVE_ZOOM);
    else localStorage.setItem(CHAVE_ZOOM, String(normalizarZoom(valor)));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  aplicarZoom();
}

/** Avisa quando o zoom muda: neste documento, em outra aba (storage) ou quando a tela muda de largura. */
export function assinarZoom(aoMudar: () => void): () => void {
  let quadro = 0;
  const aoRedimensionar = () => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      aplicarZoom();
    });
  };
  const aoArmazenar = (e: StorageEvent) => {
    if (e.key === CHAVE_ZOOM || e.key === null) aplicarZoom();
  };
  window.addEventListener(EVENTO_ZOOM, aoMudar);
  window.addEventListener("resize", aoRedimensionar);
  window.addEventListener("storage", aoArmazenar);
  return () => {
    cancelAnimationFrame(quadro);
    window.removeEventListener(EVENTO_ZOOM, aoMudar);
    window.removeEventListener("resize", aoRedimensionar);
    window.removeEventListener("storage", aoArmazenar);
  };
}

/** Script do <head>: mesma regra de `zoomAplicado`, sem depender do bundle (testado em `zoom.test.ts`). */
export const SCRIPT_ZOOM_INICIAL =
  `try{var P=${JSON.stringify(PASSOS_ZOOM)},z=parseInt(localStorage.getItem('${CHAVE_ZOOM}'),10),w=window.innerWidth,l=100;` +
  `for(var i=0;i<P.length;i++)if(w*100/P[i]>=${LARGURA_MINIMA_UTIL})l=P[i];` +
  `if(P.indexOf(z)>0)document.documentElement.style.fontSize=Math.min(z,l)+'%'}catch(x){}`;
