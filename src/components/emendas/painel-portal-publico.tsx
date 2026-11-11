"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertOctagon, AlertTriangle, Check, Copy, ExternalLink, Eye, Info, Mail, Radio } from "lucide-react";

import { CLASSE_BOTAO, CLASSE_BOTAO_PERIGO, CLASSE_BOTAO_SECUNDARIO, Mensagem, TituloPagina } from "@/components/modulo/ui";
import { publicarPortal, retirarPortal } from "@/lib/emendas/actions-portal";
import { contarPorGravidade, type AlertaPortal, type Gravidade } from "@/lib/emendas/portal-verificacao";

const ESTILO: Record<Gravidade, { nome: string; icone: typeof Info; classe: string; descricao: string }> = {
  critico: { nome: "Crítico", icone: AlertOctagon, classe: "border-red-200 bg-red-50 text-red-800", descricao: "Pode expor a Prefeitura ou os gestores. Resolva antes de publicar ou publique com ciência registrada." },
  atencao: { nome: "Atenção", icone: AlertTriangle, classe: "border-amber-200 bg-amber-50 text-amber-900", descricao: "Item exigido pela IN TCE-MG 05/2025 ainda não informado. O portal mostra \"Não informado\"." },
  info: { nome: "Informativo", icone: Info, classe: "border-slate-200 bg-slate-50 text-slate-700", descricao: "Como o público vai ver; nada obrigatório a corrigir." },
};

export function PainelPortalPublico({
  ano,
  podePublicar,
  publicadoEm,
  ciencia,
  urlPublica,
  alertas,
  idPorNumero,
  totalEmendas,
  assinantes,
  geradoEm,
}: {
  ano: number;
  podePublicar: boolean;
  publicadoEm: string | null;
  ciencia: Record<string, unknown> | null;
  urlPublica: string;
  alertas: AlertaPortal[];
  idPorNumero: Record<number, string>;
  totalEmendas: number;
  assinantes: { confirmados: number; pendentes: number } | null;
  geradoEm: string;
}) {
  const router = useRouter();
  const [ciente, setCiente] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = React.useTransition();
  const [copiado, setCopiado] = React.useState<string | null>(null);
  const n = contarPorGravidade(alertas);
  const publicado = !!publicadoEm;
  const link = `${urlPublica}?ano=${ano}`;
  const trecho = `<a href="${urlPublica}" target="_blank" rel="noopener">Emendas impositivas — acompanhe a execução</a>`;

  const copiar = async (texto: string, qual: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* navegador sem permissão: o texto continua visível para copiar à mão */
    }
  };
  const agir = (fn: () => Promise<{ sucesso: boolean; erro?: string }>, ok: string) =>
    iniciar(async () => {
      const r = await fn();
      setMsg(r.sucesso ? { tipo: "ok", texto: ok } : { tipo: "erro", texto: r.erro ?? "Não foi possível concluir." });
      if (r.sucesso) {
        setCiente(false);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina
        titulo="Portal público"
        subtitulo="A página aberta ao cidadão, sem login. Ela lê os dados deste módulo e se atualiza sozinha; antes de publicar, confira os alertas abaixo."
        acao={
          <div className="flex flex-wrap gap-2">
            <a href={`/transparencia/emendas?ano=${ano}&previa=1`} target="_blank" rel="noopener" className={CLASSE_BOTAO_SECUNDARIO}>
              <Eye className="h-4 w-4" aria-hidden /> Ver prévia
            </a>
            {publicado && (
              <a href={link} target="_blank" rel="noopener" className={CLASSE_BOTAO}>
                <ExternalLink className="h-4 w-4" aria-hidden /> Abrir o portal
              </a>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${publicado ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
              <Radio className="h-4 w-4" aria-hidden />
              {publicado ? `No ar desde ${new Date(publicadoEm!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Ainda não publicado"}
            </span>
            <span className="text-sm text-slate-600">
              Exercício {ano} · {totalEmendas} emendas · dados lidos às {new Date(geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {(["critico", "atencao", "info"] as Gravidade[]).map((g) => {
              const E = ESTILO[g];
              return (
                <a key={g} href={`#grupo-${g}`} className={`rounded-lg border p-3 ${E.classe}`}>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold">
                    <E.icone className="h-4 w-4" aria-hidden /> {E.nome}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">{n[g]}</dd>
                </a>
              );
            })}
          </dl>

          {podePublicar ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              {!publicado && n.critico > 0 && (
                <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--modulo-tinta)]" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
                  <span>
                    Li os {n.critico} alerta(s) crítico(s) e decido publicar mesmo assim. A ciência fica registrada (data, quem publicou e os alertas que havia).
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {!publicado ? (
                  <button type="button" className={CLASSE_BOTAO} disabled={pendente || (n.critico > 0 && !ciente)} onClick={() => agir(() => publicarPortal({ ano, ciente }), "Publicado. O portal já mostra este exercício.")}>
                    <Radio className="h-4 w-4" aria-hidden /> {pendente ? "Publicando…" : "Publicar no portal"}
                  </button>
                ) : (
                  <button type="button" className={CLASSE_BOTAO_PERIGO} disabled={pendente} onClick={() => confirm("Retirar o exercício do ar? O portal passa a mostrar \"em preparação\".") && agir(() => retirarPortal({ ano }), "Retirado do ar.")}>
                    Retirar do ar
                  </button>
                )}
              </div>
              {publicado && n.critico > 0 && (
                <p className="mt-3 text-sm text-red-700">
                  Atenção: depois de publicado, cada alteração vai ao ar em instantes. Há {n.critico} alerta(s) crítico(s) visíveis ao público agora.
                </p>
              )}
              {publicado && ciencia && typeof ciencia.critico === "number" && (
                <p className="mt-2 text-xs text-slate-500">
                  Na publicação havia {String(ciencia.critico)} crítico(s) e {String(ciencia.atencao ?? 0)} de atenção (registrado).
                </p>
              )}
              {msg && (
                <div className="mt-3">
                  <Mensagem tipo={msg.tipo}>{msg.texto}</Mensagem>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Só o administrador da Central publica ou retira o portal do ar. Você pode conferir os alertas e a prévia.</p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-cataguases-marinho">Link para o site da Prefeitura</h2>
            <p className="mt-1 text-xs text-slate-600">Coloque este endereço no botão &ldquo;Emendas impositivas&rdquo; da área Transparência do site.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-2 py-1.5 text-xs text-slate-800">{urlPublica}</code>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-slate-300 hover:bg-slate-50" onClick={() => copiar(urlPublica, "url")} aria-label="Copiar link">
                {copiado === "url" ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button type="button" className="mt-2 text-xs font-medium text-[var(--modulo-tinta)] hover:underline" onClick={() => copiar(trecho, "html")}>
              {copiado === "html" ? "Código copiado" : "Copiar código HTML do link"}
            </button>
          </div>
          {assinantes && (
            <div className="border-t border-slate-100 pt-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-cataguases-marinho">
                <Mail className="h-4 w-4" aria-hidden /> Boletim por e-mail
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                <strong className="tabular-nums">{assinantes.confirmados}</strong> inscrito(s) confirmados · {assinantes.pendentes} aguardando confirmação
              </p>
              <p className="mt-1 text-xs text-slate-500">Enviado uma vez por dia (8h20), só quando algo muda. Os e-mails não são mostrados aqui (LGPD).</p>
            </div>
          )}
        </section>
      </div>

      {(["critico", "atencao", "info"] as Gravidade[]).map((g) => {
        const lista = alertas.filter((a) => a.gravidade === g);
        if (!lista.length) return null;
        const E = ESTILO[g];
        return (
          <section key={g} id={`grupo-${g}`} className="scroll-mt-24">
            <h2 className="flex items-center gap-2 text-base font-semibold text-cataguases-marinho">
              <E.icone className="h-5 w-5" aria-hidden /> {E.nome} <span className="text-sm font-normal text-slate-500">· {E.descricao}</span>
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {lista.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-4">
                      <span className="font-semibold text-slate-900">{a.titulo}</span>
                      {a.emendas.length > 0 && <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${E.classe}`}>{a.emendas.length} emenda(s)</span>}
                      <span className="w-full text-sm text-slate-600">{a.detalhe}</span>
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm">
                      <p className="text-slate-700">
                        <strong>Como corrigir:</strong> {a.acao}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Base: {a.base}</p>
                      {a.emendas.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {a.emendas.map((num) => (
                            <li key={num}>
                              {idPorNumero[num] ? (
                                <Link href={`/emendas/${idPorNumero[num]}`} className="inline-flex rounded-md border border-slate-300 px-2 py-0.5 font-mono text-xs hover:bg-slate-50">
                                  nº {num}
                                </Link>
                              ) : (
                                <span className="inline-flex rounded-md border border-slate-200 px-2 py-0.5 font-mono text-xs">nº {num}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
