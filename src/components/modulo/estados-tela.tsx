"use client";

import * as React from "react";
import Link from "next/link";
import { FileWarning, SearchX, WifiOff } from "lucide-react";

import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/**
 * Telas de estado do módulo Emendas (mesmo desenho do mockup aprovado): sem internet, erro, não encontrada e carregamento lento.
 * `CartaoEstado` é só apresentação; os outros componentes trazem o comportamento.
 */

type Tom = "rede" | "erro" | "neutro";
const TONS: Record<Tom, { disco: string; icone: string }> = {
  rede: { disco: "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]", icone: "text-[color:var(--modulo-tinta)]" },
  erro: { disco: "bg-red-50", icone: "text-red-600" },
  neutro: { disco: "bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]", icone: "text-[color:var(--modulo-tinta)]" },
};

export function CartaoEstado({ tom, icone, titulo, children, acoes, extra }: { tom: Tom; icone: React.ReactNode; titulo: string; children: React.ReactNode; acoes?: React.ReactNode; extra?: React.ReactNode }) {
  const t = TONS[tom];
  return (
    <div className="grid min-h-[60dvh] place-items-center px-2 py-8">
      <div role="alert" className="emd-entra flex w-full max-w-[32.5rem] flex-col items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-5 pb-6 pt-7 text-center shadow-[0_18px_40px_-26px_rgb(15_23_42/0.35)] sm:px-8">
        <span aria-hidden className={cn("grid h-24 w-24 place-items-center rounded-full", t.disco, t.icone)}>
          {icone}
        </span>
        <h1 className="mt-1 text-xl font-semibold leading-snug tracking-tight text-cataguases-marinho text-balance">{titulo}</h1>
        <p className="max-w-[44ch] text-sm leading-relaxed text-slate-600">{children}</p>
        {extra}
        {acoes && <div className="mt-1 flex flex-wrap justify-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}

/** Código curto para citar ao pedir ajuda, com botão de copiar (cai para selecionar o texto se o navegador recusar). */
function CodigoCopiavel({ codigo }: { codigo: string }) {
  const [estado, setEstado] = React.useState<"" | "copiado" | "selecionado">("");
  const ref = React.useRef<HTMLSpanElement>(null);
  function selecionar() {
    const faixa = document.createRange();
    if (ref.current) faixa.selectNodeContents(ref.current);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(faixa);
    setEstado("selecionado");
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setEstado("copiado");
      setTimeout(() => setEstado(""), 1500);
    } catch {
      selecionar();
    }
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 font-mono text-xs text-slate-600">
      <span ref={ref}>{codigo}</span>
      <button type="button" onClick={copiar} className="rounded-md px-1.5 py-0.5 font-sans text-xs font-semibold text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)]">
        {estado === "copiado" ? "Copiado" : estado === "selecionado" ? "Selecionado" : "Copiar"}
      </button>
    </span>
  );
}

/** Erro de uma tela (usado por `error.tsx`). Sem conexão mostra a versão de rede; com conexão, o erro inesperado com o código. */
export type Destino = { href: string; rotulo: string };

export function TelaErro({ digest, detalhe, aoTentar, voltar = { href: "/", rotulo: "Voltar para a Central" }, dica }: { digest?: string; detalhe?: string; aoTentar: () => void; voltar?: Destino; /** Pista extra, mostrada abaixo do texto (ex.: confira se o schema do módulo está exposto na API). */ dica?: string }) {
  const online = useOnline();
  const [tentando, setTentando] = React.useState(false);
  const tentar = () => {
    setTentando(true);
    aoTentar();
    setTimeout(() => setTentando(false), 1500);
  };
  if (!online) {
    return (
      <CartaoEstado
        tom="rede"
        icone={<WifiOff className="h-11 w-11" strokeWidth={1.75} />}
        titulo="Você está sem internet"
        acoes={
          <button type="button" onClick={tentar} disabled={tentando} className={cn(CLASSE_BOTAO, "disabled:opacity-60")}>
            {tentando ? "Verificando…" : "Tentar de novo"}
          </button>
        }
      >
        Verifique o Wi-Fi ou o cabo de rede. Quando a conexão voltar, toque em “Tentar de novo”.
      </CartaoEstado>
    );
  }
  return (
    <CartaoEstado
      tom="erro"
      icone={<FileWarning className="h-11 w-11" strokeWidth={1.75} />}
      titulo="Algo deu errado nesta tela"
      extra={digest ? <CodigoCopiavel codigo={`ERR-${digest}`} /> : undefined}
      acoes={
        <>
          <button type="button" onClick={tentar} disabled={tentando} className={cn(CLASSE_BOTAO, "disabled:opacity-60")}>
            {tentando ? "Carregando…" : "Tentar de novo"}
          </button>
          <Link href={voltar.href} className={CLASSE_BOTAO_SECUNDARIO}>
            {voltar.rotulo}
          </Link>
        </>
      }
    >
      Não foi possível carregar. Tente de novo e, se o problema voltar, avise a gente pelo megafone do cabeçalho{digest ? ", informando o código abaixo" : ""}.
      {dica && <span className="mt-2 block text-[0.8125rem] text-slate-500">{dica}</span>}
      {detalhe && <span className="mt-3 block rounded-lg border border-slate-200 bg-slate-50 p-2 text-left font-mono text-[0.6875rem] text-slate-600 [overflow-wrap:anywhere]">{detalhe}</span>}
    </CartaoEstado>
  );
}

/** Registro que não existe, foi removido ou é de uma área que a pessoa não acompanha. `objeto` = "emenda", "veículo"… */
export function TelaNaoEncontrada({ principal, secundario, objeto = "registro" }: { principal: Destino; secundario?: Destino; objeto?: string }) {
  return (
    <CartaoEstado
      tom="neutro"
      icone={<SearchX className="h-11 w-11" strokeWidth={1.75} />}
      titulo="Não encontramos esta página"
      acoes={
        <>
          <Link href={principal.href} className={CLASSE_BOTAO}>
            {principal.rotulo}
          </Link>
          {secundario && (
            <Link href={secundario.href} className={CLASSE_BOTAO_SECUNDARIO}>
              {secundario.rotulo}
            </Link>
          )}
        </>
      }
    >
      O endereço pode estar errado, o {objeto} pode ter sido removido, ou ser de uma área que você não acompanha. Volte e procure de novo.
    </CartaoEstado>
  );
}

/**
 * Aviso no alto do módulo quando a conexão cai com a tela já aberta (o que já foi carregado continua visível), e um "Conexão
 * restaurada" curto quando volta. "Tentar de novo" confere de verdade com uma chamada ao próprio site.
 */
export function AvisoConexao() {
  const online = useOnline();
  const [verificando, setVerificando] = React.useState(false);
  const [falhou, setFalhou] = React.useState(false);
  const [restaurada, setRestaurada] = React.useState(false);
  const caiu = React.useRef(false);

  React.useEffect(() => {
    const aoVoltar = () => {
      if (!caiu.current) return;
      caiu.current = false;
      setFalhou(false);
      setRestaurada(true);
      setTimeout(() => setRestaurada(false), 3500);
    };
    const aoCair = () => {
      caiu.current = true;
      setRestaurada(false);
    };
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
    };
  }, []);

  async function tentar() {
    setVerificando(true);
    setFalhou(false);
    try {
      await fetch(`${window.location.pathname}?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" });
      window.location.reload();
    } catch {
      setFalhou(true);
    } finally {
      setVerificando(false);
    }
  }

  if (online && !restaurada) return null;
  if (online && restaurada) {
    return (
      <div role="status" className="emd-entra mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-slate-800 print:hidden">
        <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-emerald-600" />
        Conexão restaurada.
      </div>
    );
  }
  return (
    <div role="status" className="emd-entra mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-slate-800 print:hidden">
      <span aria-hidden className="h-2 w-2 flex-none animate-pulse rounded-full bg-amber-600" />
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">{falhou ? "Ainda sem conexão." : "Sem conexão."}</strong> O que já está na tela continua visível, mas gravar pode falhar até a internet voltar.
      </span>
      <button type="button" onClick={tentar} disabled={verificando} className="rounded-lg px-2.5 py-1 text-sm font-semibold text-[color:var(--modulo-tinta)] hover:bg-[color-mix(in_srgb,var(--modulo)_12%,transparent)] disabled:opacity-60">
        {verificando ? "Verificando…" : "Tentar de novo"}
      </button>
    </div>
  );
}

/**
 * Para as telas de carregamento (`loading.tsx`): linha fina de progresso no alto da janela; passados 3 s ela fica âmbar e aparece um
 * aviso curto; passados 10 s o aviso pede uma decisão (esperar mais ou tentar de novo).
 */
export function CarregandoLento() {
  const [fase, setFase] = React.useState<0 | 1 | 2>(0);
  const [paciente, setPaciente] = React.useState(false);
  React.useEffect(() => {
    const t1 = setTimeout(() => setFase(1), 3000);
    const t2 = setTimeout(() => setFase(2), 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden print:hidden">
        <i className={cn("emd-corre absolute inset-y-0 block w-[35%] rounded-full", fase === 0 ? "bg-[color:var(--modulo)]" : "bg-amber-600")} style={{ animationDuration: fase === 0 ? "1.3s" : "2.4s" }} />
      </div>
      {fase === 1 && (
        <div role="status" className="emd-entra mb-3 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-slate-800">
          <span aria-hidden className="h-2 w-2 flex-none animate-pulse rounded-full bg-amber-600" />
          Está demorando mais que o normal. Continuamos tentando.
        </div>
      )}
      {fase === 2 && !paciente && (
        <div role="alert" className="emd-entra mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800">
          <span className="min-w-[14ch] flex-1">
            <strong className="block font-semibold">A conexão está muito lenta</strong>
            <span className="text-slate-600">Pode ser o sinal de internet. Você pode esperar mais um pouco ou tentar de novo.</span>
          </span>
          <button type="button" onClick={() => setPaciente(true)} className={CLASSE_BOTAO_SECUNDARIO}>
            Continuar esperando
          </button>
          <button type="button" onClick={() => window.location.reload()} className={CLASSE_BOTAO}>
            Tentar de novo
          </button>
        </div>
      )}
    </>
  );
}
