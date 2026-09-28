"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, History, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAcao } from "@/lib/hooks/usar-acao";
import { ESTILO_CAMPO_PADRAO as ESTILO_CAMPO } from "@/lib/utils";
import {
  aprovarSolicitacao,
  recusarSolicitacao,
  type DecisaoAprovacao,
  type ResultadoModulo,
} from "@/lib/actions/solicitacoes";
import { FormularioDecisaoModulos } from "@/components/hub/formulario-decisao-modulos";
import type { CatalogoItem, DocumentoNumera } from "@/lib/catalogos-solicitacao";
import { moduloInfo } from "@/lib/modulos-info";
import type { Modulo, SolicitacaoAcesso } from "@/types/database";

type Props = {
  solicitacoes: SolicitacaoAcesso[];
  decididas: SolicitacaoAcesso[];
  setoresCompras: CatalogoItem[];
  secretariasRequerimentos: CatalogoItem[];
  documentosNumera: DocumentoNumera[];
};

export function PainelSolicitacoes({
  solicitacoes,
  decididas,
  setoresCompras,
  secretariasRequerimentos,
  documentosNumera,
}: Props) {
  const [expandidaId, setExpandidaId] = React.useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = React.useState(false);

  const catalogos = { setoresCompras, secretariasRequerimentos, documentosNumera };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-cataguases-marinho" aria-hidden />
        <h2 className="text-sm font-semibold text-cataguases-marinho">
          Solicitações de acesso {solicitacoes.length > 0 && `(${solicitacoes.length})`}
        </h2>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        Pedidos feitos em <code>/solicitar-acesso</code>. Aprovar cria (ou reaproveita) a conta e já
        libera o módulo escolhido; cada app mantém sua própria configuração de nível de acesso.
      </p>

      {solicitacoes.length === 0 ? (
        <p className="mt-4 text-xs text-slate-400">Nenhuma solicitação pendente.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {solicitacoes.map((s) => (
            <li key={s.id} className="rounded-md border border-slate-200">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                onClick={() => setExpandidaId((atual) => (atual === s.id ? null : s.id))}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.nome}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <div className="flex gap-1">
                  {s.modulos_solicitados.map((m) => {
                    const info = moduloInfo(m);
                    return (
                      <span
                        key={m}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${info.cor}1A`, color: info.corTexto }}
                      >
                        {info.nomeCurto}
                      </span>
                    );
                  })}
                </div>
              </button>

              {expandidaId === s.id && (
                <div className="border-t border-slate-100 p-3">
                  <FormularioDecisao
                    solicitacao={s}
                    {...catalogos}
                    onDecidido={() => setExpandidaId(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {decididas.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            onClick={() => setHistoricoAberto((v) => !v)}
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            Decididas recentemente ({decididas.length})
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${historicoAberto ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          {historicoAberto && (
            <ul className="mt-2 space-y-1.5">
              {decididas.map((s) => {
                const falhouAlgo = s.observacao_decisao?.includes("falhou");
                return (
                  <li key={s.id} className="rounded-md border border-slate-100">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                      onClick={() => setExpandidaId((atual) => (atual === s.id ? null : s.id))}
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-700">
                          {s.nome} <span className="font-normal text-slate-400">— {s.email}</span>
                        </p>
                        {s.observacao_decisao && (
                          <p
                            className={`mt-0.5 text-[11px] ${falhouAlgo ? "text-amber-700" : "text-slate-400"}`}
                          >
                            {s.observacao_decisao}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          s.status === "recusada"
                            ? "bg-slate-100 text-slate-500"
                            : falhouAlgo
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                        }`}
                      >
                        {s.status === "recusada" ? "Recusada" : falhouAlgo ? "Parcial" : "Aprovada"}
                      </span>
                    </button>

                    {expandidaId === s.id && s.status === "aprovada" && (
                      <div className="border-t border-slate-100 p-3">
                        <p className="mb-2 text-xs text-slate-500">
                          Tentar de novo só reprocessa os módulos marcados abaixo — o que já deu certo
                          não é afetado.
                        </p>
                        <FormularioDecisao
                          solicitacao={s}
                          {...catalogos}
                          onDecidido={() => setExpandidaId(null)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function FormularioDecisao({
  solicitacao,
  setoresCompras,
  secretariasRequerimentos,
  documentosNumera,
  onDecidido,
}: {
  solicitacao: SolicitacaoAcesso;
  setoresCompras: CatalogoItem[];
  secretariasRequerimentos: CatalogoItem[];
  documentosNumera: DocumentoNumera[];
  onDecidido: () => void;
}) {
  const modulos = solicitacao.modulos_solicitados;
  const acaoRecusar = useAcao();
  const [observacao, setObservacao] = React.useState("");
  const [resultados, setResultados] = React.useState<Partial<Record<Modulo, ResultadoModulo>> | null>(
    null
  );
  const [aprovando, setAprovando] = React.useState(false);
  const [erroAprovar, setErroAprovar] = React.useState<string | null>(null);
  const router = useRouter();

  const [decisoes, setDecisoes] = React.useState<DecisaoAprovacao>({});
  const [decisoesValidas, setDecisoesValidas] = React.useState(true);

  async function handleAprovar() {
    setAprovando(true);
    setErroAprovar(null);
    const resultado = await aprovarSolicitacao(solicitacao.id, decisoes);
    setAprovando(false);
    if (!resultado.sucesso) {
      setErroAprovar(resultado.erro);
      return;
    }
    setResultados(resultado.resultados);
    router.refresh();
  }

  if (resultados) {
    return (
      <div className="space-y-3">
        {modulos.map((m) => {
          const r = resultados[m];
          if (!r) return null;
          return (
            <div
              key={m}
              className={`rounded-md border px-3 py-2 text-sm ${
                r.sucesso
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="font-medium">
                {moduloInfo(m).nome}: {r.sucesso ? "aprovado" : "falhou"}
              </p>
              {r.mensagem && <p className="mt-0.5 text-xs">{r.mensagem}</p>}
              {r.linkPrimeiroAcesso && <LinkCopiavel link={r.linkPrimeiroAcesso} />}
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={onDecidido}>
          Fechar
        </Button>
      </div>
    );
  }

  const podeAprovar = decisoesValidas;

  return (
    <div className="space-y-4">
      {solicitacao.secretaria_sugerida && (
        <p className="text-xs text-slate-500">
          Secretaria/setor informado: <b>{solicitacao.secretaria_sugerida}</b>
        </p>
      )}
      {solicitacao.justificativa && (
        <p className="text-xs text-slate-500">
          Mensagem: <span className="italic">“{solicitacao.justificativa}”</span>
        </p>
      )}

      <FormularioDecisaoModulos
        modulosVisiveis={modulos}
        setoresCompras={setoresCompras}
        secretariasRequerimentos={secretariasRequerimentos}
        documentosNumera={documentosNumera}
        onMudar={(d, valido) => {
          setDecisoes(d);
          setDecisoesValidas(valido);
        }}
      />

      {erroAprovar && <p className="text-xs text-red-700">{erroAprovar}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={aprovando || !podeAprovar} onClick={handleAprovar}>
          {aprovando ? "Aprovando…" : "Aprovar"}
        </Button>

        {solicitacao.status === "pendente" && (
          <>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Motivo da recusa (opcional)"
              className={`${ESTILO_CAMPO} w-56`}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={acaoRecusar.pendente}
              onClick={() =>
                acaoRecusar.executar(() => recusarSolicitacao(solicitacao.id, observacao), onDecidido)
              }
            >
              {acaoRecusar.pendente ? "Recusando…" : "Recusar"}
            </Button>
          </>
        )}
      </div>
      {acaoRecusar.erro && <p className="text-xs text-red-700">{acaoRecusar.erro}</p>}
    </div>
  );
}

function LinkCopiavel({ link }: { link: string }) {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        readOnly
        value={link}
        className="flex-1 truncate rounded border border-green-300 bg-white px-2 py-1 text-[11px] text-slate-600"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="rounded border border-green-300 bg-white p-1 text-green-700 hover:bg-green-100"
        title="Copiar link"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
      >
        {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
