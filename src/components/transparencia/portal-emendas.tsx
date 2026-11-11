"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, Download, Eye, PlayCircle, RotateCcw, Search } from "lucide-react";

import { Brasao } from "@/components/brasao";
import { AlternarTema } from "@/components/layout/alternar-tema";
import { atualizarFiltrosNaUrl } from "@/lib/filtros-url";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";
import {
  agrupar,
  FILTROS_VAZIOS,
  filtrar,
  ORDENS,
  ordenar,
  pagamentosPorMes,
  partes,
  porTipo,
  SITUACOES_PUBLICAS,
  situacaoPublica,
  totais,
  type Filtros,
  type Ordem,
} from "@/lib/emendas/portal-agregados";
import type { LinhaPortal } from "@/lib/emendas/portal-tipos";
import { brl, brlCurto, dataBr, pct } from "@/lib/emendas/regras";
import { tourPorId } from "@/lib/tours/tours";

import { CadastroBoletim } from "./boletim";
import { DetalheEmenda } from "./detalhe-emenda";
import { LinhaDica, ProvedorDica, useDica } from "./dica";
import { Folha } from "./folha";
import { Anel, BarraExecucao, BarrasPorGrupo, CurvaPagamentos, Legenda, SERIES, useContagem } from "./graficos";
import { GuiaPortal } from "./guia";
import { COR_SITUACAO, ICONE_SITUACAO, SeloSituacao } from "./selos";

export type MetaPublica = {
  cota: number;
  saudeMinPct: number;
  leiLoa: string | null;
  dataLoa: string | null;
  municipio: string | null;
  unidadeParlamentar: string | null;
  publicadoEm: string | null;
};

type Props = {
  linhas: LinhaPortal[];
  versao: string;
  geradoEm: string;
  etapas: Record<string, string>;
  ano: number;
  anos: number[];
  meta: MetaPublica;
  previa: boolean;
};

const POR_PAGINA = 24;
const CHAVE_TOUR = "portal-emendas-tour-visto";
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function PortalEmendas(props: Props) {
  return (
    <ProvedorDica>
      <Portal {...props} />
    </ProvedorDica>
  );
}

function Portal({ linhas, versao, geradoEm, etapas, ano, anos, meta, previa }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const dica = useDica();
  const nomeEtapa = React.useCallback((c: string) => etapas[c] ?? c, [etapas]);

  // ——— filtros (vivem na URL, para o recorte poder ser compartilhado) ———
  const [f, setF] = React.useState<Filtros>(() => ({
    busca: params.get("q") ?? "",
    vereador: params.get("vereador") ?? "",
    secretaria: params.get("secretaria") ?? "",
    tipo: params.get("tipo") ?? "",
    situacao: params.get("situacao") ?? "",
    area: params.get("area") ?? "",
  }));
  const [ordem, setOrdem] = React.useState<Ordem>(() => (ORDENS.some((o) => o.chave === params.get("ordem")) ? (params.get("ordem") as Ordem) : "valor_desc"));
  const [limite, setLimite] = React.useState(POR_PAGINA);
  const [aberta, setAberta] = React.useState<number | null>(() => (params.get("emenda") ? Number(params.get("emenda")) : null));
  const [guia, setGuia] = React.useState(false);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [consultadoEm, setConsultadoEm] = React.useState<string | null>(null);
  const geradoAgora = consultadoEm && consultadoEm > geradoEm ? consultadoEm : geradoEm;

  const url = (m: Record<string, string | undefined>) => atualizarFiltrosNaUrl(new URLSearchParams(window.location.search), m, pathname, (u) => router.push(u, { scroll: false }));
  const mudar = (k: keyof Filtros, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setLimite(POR_PAGINA);
    url({ [k === "busca" ? "q" : k]: v || undefined });
  };
  const limpar = () => {
    setF(FILTROS_VAZIOS);
    url({ q: undefined, vereador: undefined, secretaria: undefined, tipo: undefined, situacao: undefined, area: undefined });
  };
  const abrir = (n: number | null) => {
    setAberta(n);
    url({ emenda: n ? String(n) : undefined });
  };

  // ——— atualização ao vivo: consulta a versão e recarrega só os dados quando muda ———
  React.useEffect(() => {
    let atual = versao;
    let parado = false;
    const consultar = async () => {
      if (document.hidden || parado) return;
      try {
        const r = await fetch(`/transparencia/emendas/versao?ano=${ano}${previa ? "&previa=1" : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { versao: string; geradoEm: string };
        if (j.versao !== atual) {
          atual = j.versao;
          router.refresh();
          setAviso("Dados atualizados agora");
        } else setConsultadoEm(j.geradoEm);
      } catch {
        /* sem rede: tenta na próxima */
      }
    };
    const id = window.setInterval(consultar, 30_000);
    const aoVoltar = () => !document.hidden && consultar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      parado = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
    // `versao` muda a cada refresh; a referência local acompanha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, previa, router]);
  React.useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // ——— tour: na primeira visita, e sempre pelo botão ———
  const iniciarTour = React.useCallback(async () => {
    setGuia(false);
    const tour = tourPorId("portal-emendas");
    if (!tour) return;
    const { executarTour } = await import("@/components/ajuda/executar-tour");
    window.setTimeout(() => executarTour(tour), 250);
  }, []);
  React.useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE_TOUR) || params.get("emenda")) return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_TOUR, "1");
      } catch {
        /* sem armazenamento: o tour volta a aparecer, sem prejuízo */
      }
      iniciarTour();
    }, 1400);
    return () => window.clearTimeout(t);
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ——— dados ———
  const filtradas = React.useMemo(() => filtrar(linhas, f), [linhas, f]);
  const t = React.useMemo(() => totais(filtradas), [filtradas]);
  // Cada gráfico que também é filtro mostra todas as opções (as outras dimensões continuam valendo).
  const semVereador = React.useMemo(() => filtrar(linhas, { ...f, vereador: "" }), [linhas, f]);
  const semSecretaria = React.useMemo(() => filtrar(linhas, { ...f, secretaria: "" }), [linhas, f]);
  const semTipo = React.useMemo(() => filtrar(linhas, { ...f, tipo: "" }), [linhas, f]);
  const semSituacao = React.useMemo(() => filtrar(linhas, { ...f, situacao: "" }), [linhas, f]);
  const gVereador = React.useMemo(() => agrupar(semVereador, (l) => l.vereador, (l) => l.partido), [semVereador]);
  const gSecretaria = React.useMemo(() => agrupar(semSecretaria, (l) => l.secretaria), [semSecretaria]);
  const gTipo = React.useMemo(() => porTipo(semTipo), [semTipo]);
  const tSituacao = React.useMemo(() => totais(semSituacao), [semSituacao]);
  const hojeMes = ano < new Date().getFullYear() ? 12 : new Date().getMonth() + 1;
  const curva = React.useMemo(() => pagamentosPorMes(filtradas, ano), [filtradas, ano]);
  const lista = React.useMemo(() => ordenar(filtradas, ordem), [filtradas, ordem]);

  const vereadores = React.useMemo(() => [...new Set(linhas.map((l) => l.vereador))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const secretarias = React.useMemo(() => [...new Set(linhas.map((l) => l.secretaria))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const nVereadores = vereadores.length;
  const saudeTotal = linhas.filter((l) => l.saude).reduce((s, l) => s + l.valor, 0);
  const cotaTotal = meta.cota * nVereadores;
  const ativos = (Object.keys(f) as (keyof Filtros)[]).filter((k) => f[k]);

  const valorAnimado = useContagem(t.total);
  const emendaAberta = aberta !== null ? linhas.find((l) => l.numero === aberta) ?? null : null;

  return (
    <div className="portal-raiz">
      <a href="#conteudo-portal" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black">
        Pular para o conteúdo
      </a>
      {previa && (
        <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-[#E9A63B] px-4 py-2 text-center text-[13px] font-semibold text-[#2a1a00]">
          <Eye className="h-4 w-4" aria-hidden /> Prévia da gestão — {meta.publicadoEm ? "este exercício já está publicado" : "este exercício ainda NÃO está publicado"}. O público não vê este aviso.
        </div>
      )}

      {/* ——— Herói ——— */}
      <header className="portal-heroi" data-tour="portal-heroi">
        <div aria-hidden className="portal-marca-dagua">
          <Image src="/logo.png" alt="" fill sizes="600px" className="object-cover object-top" />
        </div>
        <div className="portal-barra-topo">
          <div className="cabecalho-escuro tema-fixo mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-8 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              <span className="portal-logo-moldura h-14 w-14 sm:h-[72px] sm:w-[72px]">
                <Brasao tamanho={72} className="h-full w-full" />
              </span>
              <div className="min-w-0 leading-tight">
                <span aria-hidden className="mb-1.5 block h-[3px] w-8 rounded-full bg-[#E9A63B]" />
                <p className="text-[17px] font-semibold tracking-tight text-white sm:text-[22px]">Prefeitura de Cataguases</p>
                <p className="mt-0.5 text-[12px] font-medium uppercase tracking-[0.14em] text-[#B4C7E0] sm:text-[13px]">Portal da Transparência</p>
              </div>
            </div>
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/85 ring-1 ring-white/10 md:inline-flex" title="Os dados se atualizam sozinhos, sem recarregar a página">
              <span className="portal-pulso" aria-hidden /> Ao vivo · {hora(geradoAgora)}
            </span>
            <button type="button" onClick={() => setGuia(true)} className="portal-botao-vidro" data-tour="portal-ajuda">
              <BookOpen className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Guia de uso</span>
              <span className="sr-only sm:hidden">Guia de uso</span>
            </button>
            <AlternarTema />
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:pb-16">
          <div className="portal-revela">
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#F6D79C]">Emendas impositivas · {ano}</p>
            <h1 className="mt-3 max-w-2xl text-[clamp(1.75rem,4.2vw,3rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-white">
              Cada real indicado pelos vereadores, do orçamento ao pagamento.
            </h1>
            <p className="mt-6 text-[13px] font-medium text-white/60">{ativos.length ? "Valor indicado no recorte" : "Valor total indicado"}</p>
            <p className="portal-numero-heroi portal-gradiente-texto mt-1" aria-live="polite">
              {brl(valorAnimado)}
            </p>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
              {t.quantidade} emenda{t.quantidade === 1 ? "" : "s"}
              {!ativos.length && ` de ${nVereadores} vereadores`}
              {meta.leiLoa ? ` · ${meta.leiLoa}` : ""}
              {meta.cota > 0 && !ativos.length ? ` · cota de ${brl(meta.cota)} por vereador` : ""}
            </p>
          </div>

          <div className="portal-revela flex items-center gap-6 rounded-[28px] bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur-md" style={{ animationDelay: "120ms" }}>
            <div className="relative">
              <Anel valor={t.pago / (t.total || 1)} rotulo={`${pct(t.pago / (t.total || 1))} do valor já foi pago`} />
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[28px] font-semibold tracking-tight text-white tabular-nums">{pct(t.pago / (t.total || 1), 0)}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">pago</p>
                </div>
              </div>
            </div>
            <dl className="flex min-w-0 flex-1 flex-col gap-3">
              {SERIES.map((s) => (
                <div key={s.chave} {...dica(<p className="max-w-[240px]"><strong>{s.nome}:</strong> {s.explica}</p>)} tabIndex={0} className="rounded-lg outline-offset-4">
                  <dt className="flex items-center gap-2 text-[12px] text-white/65">
                    <span aria-hidden className={`h-2 w-2 rounded-[3px] ${s.classe}`} />
                    {s.nome}
                  </dt>
                  <dd className="text-[19px] font-semibold tracking-tight text-white tabular-nums">{brlCurto(t[s.chave])}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="portal-revela lg:col-span-2" style={{ animationDelay: "220ms" }} data-tour="portal-execucao">
            <BarraExecucao p={t} altura={18} titulo={ativos.length ? "Recorte selecionado" : `Todas as emendas de ${ano}`} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Legenda claro />
              {cotaTotal > 0 && (
                <p className="text-[13px] text-white/65" {...dica(<p className="max-w-[260px]">Valor das emendas de saúde sobre a soma das cotas dos vereadores. O mínimo legal é {String(meta.saudeMinPct).replace(".", ",")}% (CF, art. 166, § 9º).</p>)} tabIndex={0}>
                  Saúde: <strong className="font-semibold text-white">{pct(saudeTotal / cotaTotal)}</strong> das cotas · mínimo {String(meta.saudeMinPct).replace(".", ",")}%
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ——— Filtros ——— */}
      <div className="portal-filtros sticky z-50" style={{ top: previa ? 36 : 0 }} data-tour="portal-filtros">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-8">
          <Seletor rotulo="Exercício" valor={String(ano)} ativo={false} aoMudar={(v) => url({ ano: v })} opcoes={anos.map((a) => [String(a), String(a)])} />
          <Seletor rotulo="Vereador" valor={f.vereador} ativo={!!f.vereador} aoMudar={(v) => mudar("vereador", v)} opcoes={[["", "Todos os vereadores"], ...vereadores.map((v) => [v, v] as [string, string])]} />
          <Seletor rotulo="Secretaria" valor={f.secretaria} ativo={!!f.secretaria} aoMudar={(v) => mudar("secretaria", v)} opcoes={[["", "Todas as secretarias"], ...secretarias.map((v) => [v, v] as [string, string])]} />
          <Seletor rotulo="Tipo" valor={f.tipo} ativo={!!f.tipo} aoMudar={(v) => mudar("tipo", v)} opcoes={[["", "Todos os tipos"], ...ORDEM_TIPOS.map((x) => [x, TIPOS_EXECUCAO[x].nome] as [string, string])]} />
          <Seletor rotulo="Situação" valor={f.situacao} ativo={!!f.situacao} aoMudar={(v) => mudar("situacao", v)} opcoes={[["", "Todas as situações"], ...SITUACOES_PUBLICAS.map((s) => [s.chave, s.nome] as [string, string])]} />
          <Seletor rotulo="Área" valor={f.area} ativo={!!f.area} aoMudar={(v) => mudar("area", v)} opcoes={[["", "Todas as áreas"], ["saude", "Saúde"], ["demais", "Demais áreas"]]} />
          {ativos.length > 0 && (
            <button type="button" onClick={limpar} className="portal-botao-sec ml-auto">
              <RotateCcw className="h-4 w-4" aria-hidden /> Limpar ({ativos.length})
            </button>
          )}
        </div>
      </div>

      <main id="conteudo-portal" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
        {/* ——— Situação + tipo ——— */}
        <section className="grid gap-6 lg:grid-cols-5">
          <div className="portal-cartao p-6 lg:col-span-3">
            <Cabecalho rotulo="Situação" titulo="Em que pé está cada emenda" />
            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {SITUACOES_PUBLICAS.map((s) => {
                const d = tSituacao.porSituacao[s.chave];
                const Icone = ICONE_SITUACAO[s.chave];
                const sel = f.situacao === s.chave;
                return (
                  <li key={s.chave}>
                    <button
                      type="button"
                      onClick={() => mudar("situacao", sel ? "" : s.chave)}
                      aria-pressed={sel}
                      className="portal-linha-grafico flex h-full w-full flex-col items-start gap-1 border border-[var(--p-linha)] p-3.5 text-left"
                      data-selecionado={sel ? "1" : "0"}
                      data-apagado={f.situacao && !sel ? "1" : "0"}
                      {...dica(
                        <div>
                          <p className="mb-1 font-semibold">{s.nome}</p>
                          <p className="mb-1.5 text-[var(--p-tinta-3)]">{s.explicacao}</p>
                          <LinhaDica rotulo="Emendas" valor={String(d.quantidade)} forte />
                          <LinhaDica rotulo="Valor indicado" valor={brl(d.valor)} />
                        </div>
                      )}
                    >
                      <Icone className="h-5 w-5" style={{ color: COR_SITUACAO[s.chave] }} aria-hidden />
                      <span className="mt-1 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{d.quantidade}</span>
                      <span className="text-[13px] font-medium text-[var(--p-tinta)]">{s.nome}</span>
                      <span className="text-[12px] tabular-nums text-[var(--p-tinta-3)]">{brlCurto(d.valor)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="portal-cartao p-6 lg:col-span-2">
            <Cabecalho rotulo="Tipo de execução" titulo="Como o dinheiro chega" />
            <div className="portal-barra mt-5 h-3" role="img" aria-label="Divisão do valor por tipo de execução">
              {ORDEM_TIPOS.map((x) =>
                gTipo[x].total > 0 ? <span key={x} style={{ flexGrow: gTipo[x].total, flexBasis: 0, background: `var(--t-${x})` }} {...dica(<p><strong>{TIPOS_EXECUCAO[x].nome}</strong> · {brl(gTipo[x].total)}</p>)} /> : null
              )}
            </div>
            <ul className="mt-4 flex flex-col gap-1">
              {ORDEM_TIPOS.map((x) => {
                const g = gTipo[x];
                const sel = f.tipo === x;
                const tot = ORDEM_TIPOS.reduce((s, k) => s + gTipo[k].total, 0) || 1;
                return (
                  <li key={x}>
                    <button
                      type="button"
                      onClick={() => mudar("tipo", sel ? "" : x)}
                      aria-pressed={sel}
                      className="portal-linha-grafico grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left"
                      data-selecionado={sel ? "1" : "0"}
                      data-apagado={f.tipo && !sel ? "1" : "0"}
                      {...dica(
                        <div>
                          <p className="mb-1 font-semibold">{TIPOS_EXECUCAO[x].nome}</p>
                          <p className="mb-1.5 text-[var(--p-tinta-3)]">{TIPOS_EXECUCAO[x].descricao}</p>
                          <LinhaDica rotulo="Emendas" valor={String(g.quantidade)} />
                          {SERIES.map((s) => (
                            <LinhaDica key={s.chave} cor={s.cor} rotulo={s.nome} valor={brl(g[s.chave])} />
                          ))}
                        </div>
                      )}
                    >
                      <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: `var(--t-${x})` }} />
                      <span className="text-[14px] font-medium">{TIPOS_EXECUCAO[x].nome}</span>
                      <span className="text-right text-[13px] tabular-nums text-[var(--p-tinta-2)]">
                        <strong className="text-[var(--p-tinta)]">{pct(g.total / tot, 0)}</strong> · {brlCurto(g.total)}
                      </span>
                      <span className="col-span-3 pl-6">
                        <BarraExecucao p={g} altura={6} titulo={TIPOS_EXECUCAO[x].nome} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ——— Vereadores + secretarias ——— */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="portal-cartao p-6" data-tour="portal-vereadores">
            <Cabecalho rotulo="Por vereador" titulo="Quanto de cada indicação já foi pago" ajuda="Barras proporcionais ao valor indicado. Clique num nome para filtrar." />
            <div className="mt-4">
              <BarrasPorGrupo grupos={gVereador} selecionado={f.vereador} aoEscolher={(v) => mudar("vereador", v)} rotulo="Execução por vereador" limite={15} />
            </div>
          </div>
          <div className="portal-cartao p-6">
            <Cabecalho rotulo="Por secretaria" titulo="Onde o recurso é executado" ajuda="Órgão responsável pela execução. Clique para filtrar." />
            <div className="mt-4">
              <BarrasPorGrupo grupos={gSecretaria} selecionado={f.secretaria} aoEscolher={(v) => mudar("secretaria", v)} rotulo="Execução por secretaria" limite={10} />
            </div>
          </div>
        </section>

        {/* ——— Curva ——— */}
        <section className="portal-cartao p-6" data-tour="portal-curva">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Cabecalho rotulo="Ritmo dos pagamentos" titulo={`Pago ao longo de ${ano}`} ajuda="Soma acumulada dos pagamentos, mês a mês. Passe o mouse ou use as setas do teclado." />
            <dl className="flex gap-8">
              <div>
                <dt className="text-[12px] text-[var(--p-tinta-3)]">Pago no ano</dt>
                <dd className="text-[22px] font-semibold tracking-tight tabular-nums">{brlCurto(curva.pontos.at(-1)?.acumulado ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--p-tinta-3)]">Falta pagar</dt>
                <dd className="text-[22px] font-semibold tracking-tight tabular-nums">{brlCurto(t.total - t.pago)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5">
            <CurvaPagamentos pontos={curva.pontos} total={t.total} ano={ano} mesAtual={hojeMes} />
          </div>
          {curva.semData > 0.005 && <p className="mt-2 text-[12px] text-[var(--p-tinta-3)]">{brl(curva.semData)} em pagamentos sem data informada ou de outro ano não aparecem na curva, mas entram no total pago.</p>}
        </section>

        {/* ——— Lista ——— */}
        <section className="portal-cartao overflow-hidden" data-tour="portal-lista" aria-labelledby="titulo-lista">
          <div className="flex flex-wrap items-end gap-3 border-b border-[var(--p-linha)] p-6">
            <div className="mr-auto">
              <p className="portal-rotulo">As emendas</p>
              <h2 id="titulo-lista" className="portal-titulo-secao mt-1">
                {filtradas.length} {filtradas.length === 1 ? "emenda" : "emendas"}
              </h2>
            </div>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Buscar emenda</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--p-tinta-3)]" aria-hidden />
              <input type="search" value={f.busca} onChange={(e) => mudar("busca", e.target.value)} placeholder="Buscar objeto, entidade, bairro, nº" className="portal-campo w-full !pl-9" />
            </label>
            <label className="w-full sm:w-auto">
              <span className="sr-only">Ordenar</span>
              <select value={ordem} onChange={(e) => { setOrdem(e.target.value as Ordem); url({ ordem: e.target.value === "valor_desc" ? undefined : e.target.value }); }} className="portal-campo w-full">
                {ORDENS.map((o) => (
                  <option key={o.chave} value={o.chave}>
                    Ordenar: {o.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="divide-y divide-[var(--p-linha)]">
            {lista.slice(0, limite).map((l) => {
              const p = partes(l);
              return (
                <li key={l.numero}>
                  <button type="button" onClick={() => abrir(l.numero)} className="group grid w-full grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-4 text-left transition-colors hover:bg-[var(--p-superficie-2)] sm:px-6">
                    <span aria-hidden className="h-full min-h-10 w-1 rounded-full" style={{ background: `var(--t-${l.tipo})` }} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[12px] text-[var(--p-tinta-3)]">nº {l.numero}</span>
                        <SeloSituacao s={situacaoPublica(l)} pequeno />
                        {l.saude && <span className="rounded-full bg-[var(--p-superficie-2)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--p-tinta-2)]">Saúde</span>}
                      </span>
                      <span className="mt-1 block truncate text-[15.5px] font-semibold tracking-tight text-[var(--p-tinta)]">{l.objeto}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-[var(--p-tinta-3)]">
                        {l.vereador} · {l.beneficiario ?? l.secretaria}
                      </span>
                      <span className="mt-2 block max-w-md">
                        <BarraExecucao p={p} altura={5} titulo={`Emenda nº ${l.numero}`} />
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-right">
                      <span>
                        <span className="block text-[15.5px] font-semibold tabular-nums">{brlCurto(l.valor)}</span>
                        <span className="block text-[12px] tabular-nums text-[var(--p-tinta-3)]">{pct(p.pago / (p.total || 1), 0)} pago</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[var(--p-tinta-3)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
            {filtradas.length === 0 && (
              <li className="p-12 text-center">
                <p className="text-[16px] font-semibold">Nenhuma emenda neste recorte</p>
                <button type="button" onClick={limpar} className="portal-botao-sec mt-4">
                  Limpar filtros
                </button>
              </li>
            )}
          </ul>
          {filtradas.length > limite && (
            <div className="border-t border-[var(--p-linha)] p-4 text-center">
              <button type="button" onClick={() => setLimite((x) => x + POR_PAGINA)} className="portal-botao-sec">
                Mostrar mais ({filtradas.length - limite} restantes)
              </button>
            </div>
          )}
        </section>

        <CadastroBoletim vereadores={vereadores} vereadorAtual={f.vereador} />

        {/* ——— Rodapé ——— */}
        <footer className="grid gap-8 pb-8 pt-4 text-[13px] leading-relaxed text-[var(--p-tinta-2)] md:grid-cols-3">
          <div>
            <p className="portal-rotulo mb-2">Dados abertos</p>
            <p className="mb-3">Todas as emendas do exercício {ano}, com os mesmos campos desta página, para baixar e analisar.</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/transparencia/emendas/dados?ano=${ano}&formato=csv`} className="portal-botao-sec">
                <Download className="h-4 w-4" aria-hidden /> CSV (Excel)
              </a>
              <a href={`/transparencia/emendas/dados?ano=${ano}&formato=json`} className="portal-botao-sec">
                <Download className="h-4 w-4" aria-hidden /> JSON
              </a>
            </div>
          </div>
          <div>
            <p className="portal-rotulo mb-2">Sobre estas informações</p>
            <p>
              Divulgação dos elementos do art. 7º da Instrução Normativa TCE-MG nº 05/2025 e do art. 2º, § 1º, da Recomendação MPC-MG nº 01/2025, com base na Lei de Acesso à Informação
              (Lei 12.527/2011) e na Lei de Responsabilidade Fiscal (art. 48-A). Itens ainda não informados pela gestão aparecem como &ldquo;Não informado&rdquo;.
            </p>
            <p className="mt-2">
              Dados lidos diretamente do sistema de gestão das emendas e atualizados automaticamente (última leitura às {hora(geradoAgora)}).
              {meta.publicadoEm && ` Publicado em ${dataBr(meta.publicadoEm.slice(0, 10))}.`}
            </p>
          </div>
          <div>
            <p className="portal-rotulo mb-2">Privacidade e dúvidas</p>
            <p>Não são divulgados CPF, endereço nem outros dados pessoais de pessoas físicas (Lei 13.709/2018). Gestores aparecem pelo nome, no exercício da função, como exige a norma.</p>
            <p className="mt-2">Pedidos de informação: e-SIC ou Ouvidoria da Prefeitura (Lei 12.527/2011).</p>
            <button type="button" onClick={iniciarTour} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[var(--p-acento-texto)] hover:underline">
              <PlayCircle className="h-4 w-4" aria-hidden /> Rever o tour guiado
            </button>
          </div>
        </footer>
      </main>

      <Folha
        aberta={!!emendaAberta}
        aoFechar={() => abrir(null)}
        rotulo={emendaAberta ? `Emenda nº ${emendaAberta.numero}` : "Emenda"}
        subtitulo={
          emendaAberta && (
            <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--p-tinta-3)]">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: `var(--t-${emendaAberta.tipo})` }} />
              Emenda nº {emendaAberta.numero}/{emendaAberta.ano} · {TIPOS_EXECUCAO[emendaAberta.tipo].nome}
            </span>
          )
        }
        titulo={emendaAberta?.objeto ?? ""}
      >
        {emendaAberta && <DetalheEmenda l={emendaAberta} nomeEtapa={nomeEtapa} />}
      </Folha>
      <Folha aberta={guia} aoFechar={() => setGuia(false)} rotulo="Guia de uso" titulo="Guia de uso do portal" subtitulo={<span className="portal-rotulo">Ajuda</span>}>
        <GuiaPortal aoIniciarTour={iniciarTour} />
      </Folha>
      {aviso && (
        <div role="status" className="portal-aviso">
          {aviso}
        </div>
      )}
    </div>
  );
}

function Cabecalho({ rotulo, titulo, ajuda }: { rotulo: string; titulo: string; ajuda?: string }) {
  return (
    <div>
      <p className="portal-rotulo">{rotulo}</p>
      <h2 className="mt-1 text-[21px] font-semibold leading-tight tracking-tight text-[var(--p-tinta)]">{titulo}</h2>
      {ajuda && <p className="mt-1 text-[13px] text-[var(--p-tinta-3)]">{ajuda}</p>}
    </div>
  );
}

function Seletor({ rotulo, valor, opcoes, aoMudar, ativo }: { rotulo: string; valor: string; opcoes: [string, string][]; aoMudar: (v: string) => void; ativo: boolean }) {
  return (
    <label className="min-w-0 flex-[1_1_150px] sm:flex-initial">
      <span className="sr-only">{rotulo}</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className="portal-campo w-full sm:max-w-[220px]" data-ativo={ativo ? "1" : "0"} title={rotulo}>
        {opcoes.map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
