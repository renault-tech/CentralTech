import { Suspense } from "react";

import { TituloTela } from "@/components/modulo/titulo-tela";
import { PainelAbertura } from "@/components/emendas/painel-abertura";
import { lerComCache } from "@/lib/emendas/cache-dados";
import { medir } from "@/lib/emendas/tempo";
import { calcularEmendasDoExercicio } from "@/lib/emendas/calculos";
import { resumoDaLinha, type ResumoLinha } from "@/lib/emendas/resumo";
import { Vazio } from "@/components/emendas/ui";
import {
  contarPropostasPendentes,
  listarEmendasEmCache,
  listarExecucoes,
  listarMovimentos,
  listarVereadores,
  obterCatalogoEtapas,
  obterContextoEmendas,
  resolverExercicio,
} from "@/lib/emendas/dados";
import { alertas as calcularAlertas } from "@/lib/emendas/regras";
import { diasEntre, montarPainel } from "@/lib/emendas/painel-abertura";
import { carregarPanorama } from "@/lib/emendas/panorama-dados";
import { totaisPorCartao } from "@/lib/emendas/encerramento";
import { ehGestor } from "@/lib/emendas/regras";
import { dataNoFuso } from "@/lib/fuso";
import { ComparacaoExercicios } from "@/components/emendas/comparacao-exercicios";
import { anoParaComparar, curvaPercentual, pagoAte, totaisDoExercicio } from "@/lib/emendas/comparacao";
import type { MovimentoResumo } from "@/lib/emendas/dados";
import type { EmendaResumo, Exercicio } from "@/types/emendas";

export const dynamic = "force-dynamic";

export default async function PaginaPainelEmendas({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; comparar?: string }>;
}) {
  const { ano, comparar } = await searchParams;
  const { exercicio, exercicios } = await medir("painel:exercicio", () => resolverExercicio(ano));

  if (!exercicio) {
    return (
      <div className="flex flex-col gap-5">
        <TituloTela
          titulo="Emendas impositivas"
          subtitulo="Nenhum exercício cadastrado ainda."
        />
        <Vazio>
          Cadastre o exercício (ano e cota por vereador) em Configurações →
          Exercício para começar.
        </Vazio>
      </div>
    );
  }

  const [emendas, vereadores, ctx, catalogo, propostasPendentes] = await medir("painel:emendas+cadastros", () =>
    Promise.all([listarEmendasEmCache(exercicio.ano), listarVereadores(), obterContextoEmendas(), obterCatalogoEtapas(), contarPropostasPendentes().catch(() => 0)])
  );
  const ids = emendas.map((e) => e.id);
  const movimentos = await medir("painel:movimentos", () => lerComCache("movimentos", String(exercicio.ano), () => listarMovimentos(ids)));
  const [calculos, execucoes, panorama] = await medir("painel:calculos", () =>
    Promise.all([
      calcularEmendasDoExercicio(emendas, exercicio, movimentos),
      lerComCache("execucoes", String(exercicio.ano), () => listarExecucoes(ids)),
      carregarPanorama(exercicio.ano),
    ])
  );
  const resumos: Record<string, ResumoLinha> = {};
  for (const [id, c] of calculos) resumos[id] = resumoDaLinha(c);
  const hoje = dataNoFuso(new Date());
  const vereadoresAtivos = vereadores.filter((v) => v.ativo || emendas.some((e) => e.vereador_id === v.id));

  const ativas = emendas.filter((e) => e.situacao !== "cancelada");
  const executadasIncompletas = ativas.filter((e) => (e.empenhado > 0 || e.pago > 0) && (calculos.get(e.id)?.conformidade ?? []).some((i) => i.aplica && !i.ok)).length;
  const relatoriosGestao = [...calculos.values()].reduce((t, c) => t + c.pendencias.filter((p) => p.regra.startsWith("relatorio_gestao") && !p.justificativa).length, 0);
  const paradas = calcularAlertas(emendas, movimentos, { hoje: new Date(`${hoje}T12:00:00`), ano: exercicio.ano, diasParado: 30, catalogo }).find((a) => a.chave === "paradas")?.quantidade ?? 0;
  const admin = ctx.situacao === "ok" && ctx.usuario.admin_hub;

  const painel = montarPainel({
    ano: exercicio.ano,
    hoje,
    emendas,
    resumos,
    movimentos,
    vereadores: vereadoresAtivos,
    cotaPorVereador: exercicio.cota_por_vereador,
    saudeMinimoPct: exercicio.percentual_saude_min,
    tetoRestos: exercicio.restos_teto_valor == null ? null : Number(exercicio.restos_teto_valor),
    prazoExequibilidade: exercicio.prazo_exequibilidade,
    execucoes: execucoes.map((x) => ({ emenda_id: x.id, vigencia_fim: x.vigencia_fim })),
    contagens: { propostasPendentes, executadasIncompletas, relatoriosGestao, semSituacao: totaisPorCartao(panorama.linhas).sem_situacao.quantidade, paradas },
    portalPublicado: admin ? Boolean(exercicio.portal_publicado_em) : null,
    gestor: ctx.situacao === "ok" && ehGestor(ctx.perfil),
  });

  const fuso = "America/Sao_Paulo";
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const nome = ctx.situacao === "ok" ? ctx.usuario.nome.trim().split(/\s+/)[0] : "";
  const saudacao = `${hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}${nome ? `, ${nome}` : ""}.`;
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const diasFim = diasEntre(hoje, `${exercicio.ano}-12-31`);

  return (
    <div className="flex flex-col gap-4">
      {emendas.length === 0 ? (
        <Vazio>
          Nenhuma emenda de {exercicio.ano} visível para você. Gestores cadastram em “Nova emenda” ou importam a planilha em Configurações → Importar.
        </Vazio>
      ) : (
        <>
          <PainelAbertura painel={painel} ano={exercicio.ano} saudacao={saudacao} dataExtenso={dataExtenso} diasFim={diasFim} />
          <Suspense>
            <CartaoComparacao exercicio={exercicio} emendas={emendas} movimentos={movimentos} anos={exercicios.map((e) => e.ano)} comparar={comparar} hoje={hoje} />
          </Suspense>
        </>
      )}
    </div>
  );
}

/** Comparação com outro exercício. Sem outro ano cadastrado mostra o estado de espera; com ele, calcula e compara sozinha. */
async function CartaoComparacao({
  exercicio,
  emendas,
  movimentos,
  anos,
  comparar,
  hoje,
}: {
  exercicio: Exercicio;
  emendas: EmendaResumo[];
  movimentos: MovimentoResumo[];
  anos: number[];
  comparar?: string;
  hoje: string;
}) {
  const alvo = anoParaComparar(exercicio.ano, anos, comparar);
  const outros = anos.filter((a) => a !== exercicio.ano).sort((a, b) => b - a);
  if (alvo === null) return <ComparacaoExercicios ano={exercicio.ano} dados={null} outros={[]} hrefBase={() => "#"} />;

  const emendasAnt = await listarEmendasEmCache(alvo);
  const movAnt = await lerComCache("movimentos", String(alvo), () => listarMovimentos(emendasAnt.map((e) => e.id)));
  const pagamentos = (m: MovimentoResumo[]) => m.filter((x) => x.tipo === "pagamento").map((x) => ({ data: x.data, valor: Number(x.valor) }));
  const atual = totaisDoExercicio(exercicio.ano, emendas);
  const anterior = totaisDoExercicio(alvo, emendasAnt);
  const pagAtual = pagamentos(movimentos);
  const pagAnt = pagamentos(movAnt);
  // Ano em curso: compara até hoje; ano já passado: o exercício inteiro (31/12).
  const mesDia = hoje.startsWith(`${exercicio.ano}-`) ? hoje.slice(5) : "12-31";
  const [mm, dd] = mesDia.split("-");
  return (
    <ComparacaoExercicios
      ano={exercicio.ano}
      outros={outros}
      hrefBase={(a) => `/emendas?ano=${exercicio.ano}&comparar=${a}`}
      dados={{
        atual,
        anterior,
        curvaAtual: curvaPercentual(pagAtual, exercicio.ano, atual.valor),
        curvaAnterior: curvaPercentual(pagAnt, alvo, anterior.valor),
        mesmoPeriodo: { rotuloData: `${dd}/${mm}`, atual: pagoAte(pagAtual, exercicio.ano, mesDia), anterior: pagoAte(pagAnt, alvo, mesDia) },
        mesAtual: hoje.startsWith(`${exercicio.ano}-`) ? Number(mm) : null,
      }}
    />
  );
}
