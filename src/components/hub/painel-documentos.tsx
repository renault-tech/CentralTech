"use client";

import * as React from "react";
import { CheckCircle2, FolderOpen, HardDrive, Plug, ShieldCheck } from "lucide-react";

import { useDialogos } from "@/components/ui/dialogos";
import { escolherPastaNoGoogle } from "@/components/hub/seletor-pasta-google";
import { definirPermissaoDocumentos, desconectarDrive, dadosDoSeletor, prepararPastas, testarConexao } from "@/lib/documentos/actions";
import type { StatusArmazenamento } from "@/lib/documentos/config";
import type { LinhaPermissaoDocumentos } from "@/lib/dados/documentos-config";

const BOTAO = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-cataguases-marinho px-3.5 py-1 text-sm font-medium text-white hover:brightness-125 disabled:opacity-50";
const BOTAO_2 = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-sm text-cataguases-marinho hover:bg-slate-50 disabled:opacity-50";
const CARTAO = "rounded-xl border border-slate-200 bg-white p-4 sm:p-5";

const ERROS: Record<string, string> = {
  sem_credenciais: "Faltam as chaves do Google neste ambiente (veja o passo a passo).",
  negado: "A autorização foi negada no Google.",
  state: "A volta do Google não bateu com o pedido. Tente conectar de novo.",
  codigo: "O Google não devolveu o código. Tente conectar de novo.",
  sem_refresh: "O Google não deu a autorização permanente. Retire o acesso do app em myaccount.google.com/permissions e conecte de novo.",
  falha: "Não foi possível concluir a conexão. Tente de novo.",
};

const ROTULO_PERFIL: Record<string, string> = { admin: "Administrador", gestor: "Gestor", admin_secretaria: "Secretaria (admin)", operador: "Secretaria", consulta: "Consulta" };

export function PainelDocumentos({
  status,
  linhas,
  redirectUri,
  seletorDisponivel,
  erro,
  conectado,
}: {
  status: StatusArmazenamento;
  linhas: LinhaPermissaoDocumentos[];
  redirectUri: string;
  seletorDisponivel: boolean;
  erro?: string;
  conectado?: boolean;
}) {
  const { confirmar } = useDialogos();
  const [pendente, iniciar] = React.useTransition();
  const [aviso, setAviso] = React.useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    erro ? { tipo: "erro", texto: ERROS[erro] ?? ERROS.falha } : conectado ? { tipo: "ok", texto: "Drive conectado. Agora escolha a pasta." } : null
  );
  const [nomeNova, setNomeNova] = React.useState("Documentos da plataforma");

  const rodar = (acao: () => Promise<{ sucesso: boolean; erro?: string; mensagem?: string }>) =>
    iniciar(async () => {
      const r = await acao();
      setAviso(r.sucesso ? { tipo: "ok", texto: r.mensagem ?? "Feito." } : { tipo: "erro", texto: r.erro ?? "Não foi possível concluir." });
    });

  const escolher = () =>
    iniciar(async () => {
      const d = await dadosDoSeletor();
      if (!d.sucesso) return setAviso({ tipo: "erro", texto: d.erro });
      try {
        const pasta = await escolherPastaNoGoogle(d);
        if (!pasta) return;
        const r = await prepararPastas({ pastaId: pasta.id, nomeNovaPasta: nomeNova });
        setAviso(r.sucesso ? { tipo: "ok", texto: `Pastas criadas dentro de “${pasta.nome}”.` } : { tipo: "erro", texto: r.erro });
      } catch (e) {
        setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível abrir o seletor." });
      }
    });

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${aviso.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {aviso.texto}
        </p>
      )}

      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-cataguases-marinho">
          <Plug className="h-4 w-4" aria-hidden /> 1. Conta do Google Drive
        </h2>
        {!status.configuradoNoServidor ? (
          <div className="mt-2 text-sm text-slate-700">
            <p>Falta configurar o Google neste ambiente. É feito uma vez, no Google Cloud, com a conta da instituição.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
              <li>Em console.cloud.google.com, crie um projeto e ative a <b>Google Drive API</b>.</li>
              <li>Em “Tela de consentimento OAuth”, tipo <b>Externo</b>, e publique o app (“Em produção”). O escopo usado é só <code>drive.file</code>.</li>
              <li>Em “Credenciais”, crie um <b>ID do cliente OAuth</b> (aplicativo da Web) com este endereço de retorno:
                <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 text-xs">{redirectUri}</code>
              </li>
              <li>Na Vercel, grave <code>GOOGLE_OAUTH_CLIENT_ID</code>, <code>GOOGLE_OAUTH_CLIENT_SECRET</code> e <code>DOCUMENTOS_CHAVE_CRIPTO</code> (um texto longo e aleatório).</li>
              <li>Opcional, para escolher uma pasta já existente: crie uma <b>chave de API</b> e grave <code>GOOGLE_PICKER_API_KEY</code> e <code>GOOGLE_PROJECT_NUMBER</code>.</li>
            </ol>
          </div>
        ) : status.conectado ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Conectado como <b>{status.email ?? "conta do Google"}</b>
            </span>
            <a href="/api/documentos/google/conectar" className={BOTAO_2}>Trocar conta</a>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-red-700 hover:underline"
              onClick={async () => {
                if (await confirmar({ titulo: "Desconectar o Drive?", mensagem: "Os arquivos continuam no Drive. Os envios param até conectar de novo.", rotuloConfirmar: "Desconectar", tom: "perigo" })) rodar(desconectarDrive);
              }}
            >
              Desconectar
            </button>
            {status.ultimoErro && <p className="basis-full rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">{status.ultimoErro}</p>}
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-2 text-sm text-slate-700">
            <p>Conecte a conta onde os documentos serão guardados. Use a conta da instituição.</p>
            <a href="/api/documentos/google/conectar" className={BOTAO}>
              <HardDrive className="h-4 w-4" aria-hidden /> Conectar Google Drive
            </a>
          </div>
        )}
      </section>

      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-cataguases-marinho">
          <FolderOpen className="h-4 w-4" aria-hidden /> 2. Pasta dos documentos
        </h2>
        {!status.conectado ? (
          <p className="mt-2 text-sm text-slate-500">Conecte o Drive primeiro.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3 text-sm text-slate-700">
            {status.pastasProntas ? (
              <p className="inline-flex flex-wrap items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden /> Pastas prontas em <b>{status.pastaRaiz}</b>: Originais (privada), Publicada e Internos.
              </p>
            ) : (
              <p>Escolha uma pasta. A plataforma cria dentro dela as três pastas que precisa: <b>Originais (privada)</b>, <b>Publicada</b> e <b>Internos</b>.</p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              {seletorDisponivel && (
                <button type="button" className={BOTAO} disabled={pendente} onClick={escolher}>
                  {status.pastasProntas ? "Trocar pasta" : "Escolher pasta no Drive"}
                </button>
              )}
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                {seletorDisponivel ? "Ou criar uma pasta nova" : "Nome da pasta nova (na raiz do Drive)"}
                <input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} maxLength={80} className="h-9 w-64 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800" />
              </label>
              <button type="button" className={BOTAO_2} disabled={pendente || nomeNova.trim().length < 2} onClick={() => rodar(() => prepararPastas({ pastaId: null, nomeNovaPasta: nomeNova }))}>
                Criar pasta nova
              </button>
              {status.pastasProntas && (
                <button type="button" className={BOTAO_2} disabled={pendente} onClick={() => rodar(testarConexao)}>
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Testar conexão
                </button>
              )}
            </div>
            {!seletorDisponivel && <p className="text-xs text-slate-500">Para usar uma pasta que já existe, falta a chave do seletor do Google (veja o passo a passo acima).</p>}
          </div>
        )}
      </section>

      <section className={CARTAO}>
        <h2 className="text-sm font-semibold text-cataguases-marinho">3. Quem pode enviar e quem pode analisar</h2>
        <p className="mt-0.5 text-xs text-slate-500">“Padrão” segue o perfil. Quem não edita a emenda não envia, mesmo com “Sim”.</p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Pessoa</th>
                <th className="px-3 py-2 font-medium">Perfil</th>
                <th className="px-3 py-2 font-medium">Enviar</th>
                <th className="px-3 py-2 font-medium">Analisar e aprovar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map((l) => (
                <tr key={l.usuarioId}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800">{l.nome}</p>
                    <p className="text-xs text-slate-500">{l.secretaria ?? l.email}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{ROTULO_PERFIL[l.perfil] ?? l.perfil}</td>
                  <td className="px-3 py-2"><SeletorPermissao linha={l} campo="pode_enviar" valor={l.ajusteEnviar} efetivo={l.enviar} desabilitado={l.perfil === "admin"} rodar={rodar} /></td>
                  <td className="px-3 py-2"><SeletorPermissao linha={l} campo="pode_analisar" valor={l.ajusteAnalisar} efetivo={l.analisar} desabilitado={l.perfil === "admin"} rodar={rodar} /></td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Nenhuma pessoa com acesso ao Emendas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SeletorPermissao({
  linha,
  campo,
  valor,
  efetivo,
  desabilitado,
  rodar,
}: {
  linha: LinhaPermissaoDocumentos;
  campo: "pode_enviar" | "pode_analisar";
  valor: boolean | null;
  efetivo: boolean;
  desabilitado: boolean;
  rodar: (acao: () => Promise<{ sucesso: boolean; erro?: string; mensagem?: string }>) => void;
}) {
  const atual = valor === null ? "padrao" : valor ? "sim" : "nao";
  return (
    <select
      aria-label={`${campo === "pode_enviar" ? "Enviar" : "Analisar"} — ${linha.nome}`}
      value={atual}
      disabled={desabilitado}
      onChange={(e) => {
        const v = e.target.value === "padrao" ? null : e.target.value === "sim";
        rodar(() => definirPermissaoDocumentos({ usuarioId: linha.usuarioId, campo, valor: v }));
      }}
      className="h-9 w-40 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 disabled:bg-slate-50"
    >
      <option value="padrao">Padrão ({efetivo && valor === null ? "sim" : valor === null ? "não" : "—"})</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>
  );
}
