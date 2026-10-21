import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { BotaoImprimir } from "@/components/emendas/botao-imprimir";
import { BarraEtapas, Chip, LinkVoltar, SeloEtapa } from "@/components/emendas/ui";
import { listarEmendas, listarVereadores, resolverExercicio } from "@/lib/emendas/dados";
import { brl, cumpreSaude, dataBr, numeroVereador, pct, porSecretaria } from "@/lib/emendas/regras";
import { dataNoFuso } from "@/lib/fuso";

export const dynamic = "force-dynamic";

const CORES = ["#0C1D33", "#6B4FBB", "#2563A8", "#16A34A", "#E9A63B", "#C63B22", "#0D9488", "#94A3B8", "#9479DD", "#475569", "#B45309", "#7C3AED", "#0369A1", "#65A30D"];

export default async function PaginaVereador({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ano?: string }> }) {
  const [{ id }, { ano }] = await Promise.all([params, searchParams]);
  const { exercicio } = await resolverExercicio(ano);
  if (!exercicio) notFound();
  const [emendas, vereadores] = await Promise.all([listarEmendas(exercicio.ano), listarVereadores()]);
  const vereador = vereadores.find((v) => v.id === id);
  if (!vereador) notFound();

  const dele = emendas.filter((e) => e.vereador_id === id).sort((a, b) => a.numero_vereador - b.numero_vereador);
  const validas = dele.filter((e) => e.situacao !== "cancelada");
  const cota = exercicio.cota_por_vereador;
  const total = validas.reduce((t, e) => t + e.valor, 0);
  const saude = validas.filter((e) => e.saude).reduce((t, e) => t + e.valor, 0);
  const pago = validas.reduce((t, e) => t + e.pago, 0);
  const empenhado = validas.reduce((t, e) => t + e.empenhado, 0);
  const okSaude = cumpreSaude(saude, cota, exercicio.percentual_saude_min);
  const distrib = porSecretaria(validas);

  const medidores = [
    { rotulo: "Cota utilizada", valor: pct(total / cota), de: brl(total), w: total / cota, cor: "#0C1D33", apoio: total >= cota - 0.01 ? "Cota totalmente indicada" : `Saldo de ${brl(cota - total)} sem indicação` },
    { rotulo: `Saúde (mínimo ${exercicio.percentual_saude_min}%)`, valor: pct(saude / cota), de: brl(saude), w: saude / cota, cor: okSaude ? "#16A34A" : "#D97706", apoio: okSaude ? "Regra constitucional atendida" : `Faltam ${brl(cota * (exercicio.percentual_saude_min / 100) - saude)}`, marca: exercicio.percentual_saude_min / 100 },
    { rotulo: "Empenhado", valor: pct(total ? empenhado / total : 0), de: brl(empenhado), w: total ? empenhado / total : 0, cor: "#9479DD", apoio: "do valor indicado" },
    { rotulo: "Pago", valor: pct(total ? pago / total : 0), de: brl(pago), w: total ? pago / total : 0, cor: "#563A9E", apoio: `${validas.filter((e) => e.pago > 0).length} de ${validas.length} emendas com pagamento` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <LinkVoltar href={`/emendas/vereadores?ano=${exercicio.ano}`}>Todos os vereadores</LinkVoltar>

      <p className="hidden text-xs text-slate-600 print:block">
        Central Cataguases · Emendas Impositivas · Relatório emitido em {dataBr(dataNoFuso(new Date()))}
      </p>
      <section className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#0C1D33,#132C4C_55%,#0E2440)] px-6 py-6 text-white print:bg-none print:px-0 print:text-cataguases-marinho">
        <div>
          <span className="mb-3 block h-[3px] w-9 rounded-full bg-cataguases-dourado" aria-hidden />
          <p className="text-[13px] text-slate-300 print:text-slate-600">Vereador(a) nº {numeroVereador(vereador.numero)} · Exercício {exercicio.ano}</p>
          <h1 className="mt-1 text-2xl font-semibold">{vereador.nome}</h1>
          <p className="mt-1 text-sm text-slate-300 print:text-slate-600">
            {dele.length} emendas · cota de {brl(cota)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BotaoImprimir className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 text-sm text-white hover:bg-white/15" />
          <a
            href={`/emendas/exportar?ano=${exercicio.ano}&v=${vereador.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 text-sm text-white hover:bg-white/15"
          >
            <Download className="h-4 w-4" aria-hidden /> Exportar Excel
          </a>
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
        {medidores.map((m) => (
          <div key={m.rotulo} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 [break-inside:avoid]">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.rotulo}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums" style={{ color: m.cor === "#9479DD" ? "#4C3494" : m.cor }}>
                {m.valor}
              </span>
              <span className="text-[13px] text-slate-600">{m.de}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full" style={{ width: `${Math.min(1, m.w) * 100}%`, backgroundColor: m.cor }} />
              {m.marca !== undefined && <span className="absolute -top-1 h-[18px] w-0.5 bg-cataguases-marinho" style={{ left: `${m.marca * 100}%` }} aria-hidden />}
            </div>
            <span className="text-xs text-slate-500">{m.apoio}</span>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 [break-inside:avoid]">
        <h2 className="mb-3 text-[15px] font-semibold text-cataguases-marinho">Para onde vai a cota</h2>
        <div className="flex h-6 overflow-hidden rounded-md" aria-hidden>
          {distrib.map((d, i) => (
            <span key={d.secretariaId} title={d.nome} style={{ width: `${(d.total / (total || 1)) * 100}%`, backgroundColor: CORES[i % CORES.length] }} className="border-r-2 border-white last:border-0" />
          ))}
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {distrib.map((d, i) => (
            <li key={d.secretariaId} className="flex items-center gap-2 text-[13px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CORES[i % CORES.length] }} aria-hidden />
              <span className="flex-1">{d.nome}</span>
              <strong className="tabular-nums">
                {brl(d.total)} · {pct(d.total / (total || 1), 0)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <h2 className="px-5 pb-2 pt-4 text-[15px] font-semibold text-cataguases-marinho">Emendas do vereador</h2>
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th scope="col" className="px-4 py-2 font-medium">ID</th>
              <th scope="col" className="px-4 py-2 font-medium">Nº</th>
              <th scope="col" className="px-4 py-2 font-medium">Objeto</th>
              <th scope="col" className="px-4 py-2 font-medium">Secretaria</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
              <th scope="col" className="w-52 px-4 py-2 font-medium">Andamento</th>
            </tr>
          </thead>
          <tbody>
            {dele.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top [break-inside:avoid]">
                <td className="px-4 py-2.5 font-mono text-slate-500">{e.numero_vereador}</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{e.numero}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/emendas/${e.id}`} className="font-medium text-cataguases-marinho hover:underline">
                    {e.objeto}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-slate-600">
                    {e.beneficiario_nome}
                    {e.saude && <Chip tom="saude">Saúde</Chip>}
                  </div>
                </td>
                <td className="px-4 py-2.5">{e.secretaria_nome}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{brl(e.valor)}</td>
                <td className="px-4 py-2.5">
                  <BarraEtapas modalidade={e.modalidade} etapa={e.etapa} situacao={e.situacao} />
                  <div className="mt-1.5">
                    <SeloEtapa etapa={e.etapa} situacao={e.situacao} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
