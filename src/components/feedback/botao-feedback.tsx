"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enviarFeedback } from "@/lib/actions/feedback";
import { APPS_FEEDBACK, ORDEM_APPS, ROTULO_TIPO } from "@/lib/feedback/apps";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn, ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import type { AppFeedback, TipoFeedback } from "@/types/database";

const TAMANHO_MAX_MB = 5;
const MAX_ANEXOS = 5;

/**
 * Megafone do header — MESMO botão, ícone e formulário em todos os apps.
 * Aqui no Hub a pessoa escolhe sobre qual app está falando (nos outros o
 * app é fixo: o feedback é daquele app). Anexos sobem direto para o bucket
 * privado, na pasta da própria pessoa; só os caminhos vão para a RPC.
 */
export function BotaoFeedback() {
  const pathname = usePathname();
  const [aberto, setAberto] = React.useState(false);
  const [app, setApp] = React.useState<AppFeedback>("hub");
  const [tipo, setTipo] = React.useState<TipoFeedback>("sugestao");
  const [mensagem, setMensagem] = React.useState("");
  const [arquivos, setArquivos] = React.useState<File[]>([]);
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviado, setEnviado] = React.useState(false);

  function limparEFechar(novo: boolean) {
    setAberto(novo);
    if (!novo) {
      setApp("hub");
      setTipo("sugestao");
      setMensagem("");
      setArquivos([]);
      setErro(null);
      setEnviado(false);
    }
  }

  function aoEscolherArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(e.target.files ?? []);
    e.target.value = "";
    const grandes = novos.filter((f) => f.size > TAMANHO_MAX_MB * 1024 * 1024);
    const validos = novos.filter((f) => f.size <= TAMANHO_MAX_MB * 1024 * 1024);
    const combinados = [...arquivos, ...validos];
    const avisos: string[] = [];
    if (grandes.length > 0) avisos.push(`${grandes.map((f) => f.name).join(", ")}: passa de ${TAMANHO_MAX_MB}MB.`);
    if (combinados.length > MAX_ANEXOS) avisos.push(`Máximo de ${MAX_ANEXOS} anexos.`);
    setArquivos(combinados.slice(0, MAX_ANEXOS));
    setErro(avisos.length > 0 ? avisos.join(" ") : null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (mensagem.trim().length < 5) {
      setErro("Escreva um pouco mais.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const supabase = criarClienteNavegador();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErro("Sessão expirada — recarregue a página.");
        return;
      }
      const caminhos: string[] = [];
      for (const arquivo of arquivos) {
        const caminho = `${user.id}/${crypto.randomUUID()}-${arquivo.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("feedback-anexos")
          .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (error) throw new Error(`Não foi possível enviar o anexo "${arquivo.name}".`);
        caminhos.push(caminho);
      }
      const r = await enviarFeedback({ app, tipo, mensagem: mensagem.trim(), pagina: pathname, anexos: caminhos });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setEnviado(true);
      setMensagem("");
      setArquivos([]);
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={limparEFechar}>
      <button
        type="button"
        aria-label="Enviar feedback"
        title="Enviar feedback"
        onClick={() => setAberto(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Megaphone className="h-5 w-5" aria-hidden strokeWidth={1.8} />
      </button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
        </DialogHeader>

        {enviado ? (
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-600">Recebido, obrigado! Sua mensagem chega direto a quem cuida da plataforma.</p>
            <div className="flex items-center gap-3">
              <Button size="sm" type="button" onClick={() => limparEFechar(false)}>
                Fechar
              </Button>
              <Link href="/feedback" onClick={() => limparEFechar(false)} className="text-xs text-cataguases-azul hover:underline">
                Ver meus envios
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={enviar}>
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-app" className="text-xs text-slate-500">
                Sobre qual aplicativo?
              </label>
              <select id="fb-app" value={app} onChange={(e) => setApp(e.target.value as AppFeedback)} className={ESTILO_CAMPO}>
                {ORDEM_APPS.map((a) => (
                  <option key={a} value={a}>
                    {APPS_FEEDBACK[a].nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-tipo" className="text-xs text-slate-500">
                Tipo
              </label>
              <select id="fb-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoFeedback)} className={ESTILO_CAMPO}>
                {(Object.keys(ROTULO_TIPO) as TipoFeedback[]).map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-msg" className="text-xs text-slate-500">
                Mensagem
              </label>
              <textarea
                id="fb-msg"
                required
                minLength={5}
                maxLength={4000}
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Conte o que aconteceu ou o que você gostaria de ver..."
                className={cn(ESTILO_CAMPO, "resize-none")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fb-anexos" className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-cataguases-azul hover:text-cataguases-azul/80">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                Anexar screenshot
              </label>
              <input
                id="fb-anexos"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
                multiple
                onChange={aoEscolherArquivos}
                className="hidden"
                disabled={arquivos.length >= MAX_ANEXOS}
              />
              {arquivos.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {arquivos.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setArquivos((at) => at.filter((_, j) => j !== i))}
                        aria-label={`Remover ${a.name}`}
                        className="shrink-0 text-slate-400 hover:text-cataguases-vermelho"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {erro && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => limparEFechar(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
