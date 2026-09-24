import type { Modulo } from "@/types/database";

export type InfoModulo = {
  chave: Modulo;
  nome: string;
  /** Rótulo curto (1 palavra) — cabeçalho de coluna/badge, onde o nome
   * completo não cabe. */
  nomeCurto: string;
  descricao: string;
  url: string;
  /** Cor de identidade do módulo — fundo/borda/preenchimento, nunca texto
   * direto (ver `corTexto`). */
  cor: string;
  /** Versão de `cor` segura para texto/ícone sobre fundo branco (≥4,5:1,
   * WCAG AA) — o azul vivo do Numera (#0071e3) mede ~4,54:1 sozinho,
   * abaixo da margem de segurança que o resto da plataforma usa. */
  corTexto: string;
};

/**
 * Catálogo estático dos módulos da plataforma. Cada um é um app
 * independente (repo/deploy/banco próprios ou compartilhados — Compras e
 * Requerimentos já dividem o mesmo Supabase, Numera é isolado), sem SSO
 * real entre eles: o card só leva pra URL de produção, o login de lá é o
 * de sempre.
 *
 * Módulo sem dependência de servidor (sem next/headers), para poder ser
 * importado por Client Components. `src/lib/dados/modulos.ts` reexporta.
 */
export const MODULOS: Record<Modulo, InfoModulo> = {
  compras: {
    chave: "compras",
    nome: "Compras, Licitações e Contratos",
    nomeCurto: "Compras",
    descricao: "Fluxo de trabalho de Compras, Licitações e Contratos da Secretaria de Administração.",
    url: "https://app-compras-brown.vercel.app",
    cor: "#0C1D33",
    corTexto: "#0C1D33",
  },
  numera: {
    chave: "numera",
    nome: "Numera",
    nomeCurto: "Numera",
    descricao: "Numeração sequencial de documentos oficiais.",
    url: "https://app-numera-o-de-docs.vercel.app",
    cor: "#0071e3",
    corTexto: "#0058B0",
  },
  requerimentos: {
    chave: "requerimentos",
    nome: "Requerimentos da Câmara",
    nomeCurto: "Requerimentos",
    descricao: "Requerimentos da Câmara Municipal, distribuídos às secretarias pelo Gabinete do Prefeito.",
    url: "https://app-requerimentos-camara.vercel.app",
    cor: "#C63B22",
    corTexto: "#C63B22",
  },
};

/**
 * `MODULOS[chave]` direto assume que `chave` é sempre um dos 3 valores
 * válidos — verdade quando o dado vem tipado (`Modulo`), mas não quando
 * vem de uma tabela que um `anon` pode inserir (`hub.solicitacoes_acesso`,
 * protegida por CHECK no banco, mas defesa em profundidade: nenhuma tela
 * deve quebrar por um valor inesperado). Achado real de auditoria: sem
 * essa guarda, uma chave desconhecida derrubava a tela inteira de
 * Solicitações (nenhum error boundary no app), travando o único fluxo de
 * concessão de acesso da plataforma.
 */
export function moduloInfo(chave: string): InfoModulo {
  return (
    (MODULOS as Record<string, InfoModulo>)[chave] ?? {
      chave: chave as Modulo,
      nome: chave,
      nomeCurto: chave,
      descricao: "",
      url: "#",
      cor: "#94A3B8",
      corTexto: "#475569",
    }
  );
}
