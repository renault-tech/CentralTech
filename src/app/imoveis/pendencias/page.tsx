import Link from "next/link";

import { BotaoJustificar } from "@/components/imoveis/botao-justificar";
import { MenuExportarImoveis } from "@/components/imoveis/menu-exportar-imoveis";
import { Cartao, SeloGravidade, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { FormularioFiltros } from "@/components/modulo/formulario-filtros";
import { CLASSE_BOTAO_SECUNDARIO } from "@/components/modulo/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { formatarData } from "@/lib/imoveis/regras";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

export const metadata = { title: "Pendências · Imóveis e Consumo" };
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PendenciasImoveis({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const g = um(sp.g);
  const s = um(sp.s);
  const q = um(sp.q).trim().toLowerCase();
  const mostrarJustificadas = um(sp.j) === "1";
  const ctx = await obterContextoImoveis();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const t = await carregarTudo();

  const imovel = new Map(t.imoveis.map((i) => [i.id, i]));
  const nomeSec = new Map(t.secretarias.map((x) => [x.id, x.nome]));
  const justif = new Map(t.justificadas.map((j) => [`${j.imovel_id}|${j.chave}|${j.assinatura}`, j]));
  const base = mostrarJustificadas ? t.todas : t.pendencias;
  const lista = base.filter((p) => {
    const im = imovel.get(p.imovelId);
    if (!im) return false;
    if (g && p.nivel !== g) return false;
    if (s && im.secretaria_id !== s) return false;
    if (q && !`${im.nome} ${p.titulo} ${p.detalhe}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const totalJustificadas = t.todas.length - t.pendencias.length;

  return (
    <>
      <TituloPagina titulo="Pendências" subtitulo="Tudo o que o sistema encontrou fora do normal. Pendência justificada deixa de contar enquanto o dado não mudar." acao={<MenuExportarImoveis relatorios={[{ r: "pendencias", rotulo: "Pendências" }]} />} />
      <Cartao semPadding>
        <FormularioFiltros className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4 sm:px-5" limpar={{ href: "/imoveis/pendencias", className: CLASSE_BOTAO_SECUNDARIO }}>
          <div className="flex min-w-[200px] flex-[2] flex-col gap-1">
            <label htmlFor="f-q" className="text-xs font-semibold text-slate-600">Buscar</label>
            <input id="f-q" name="q" defaultValue={um(sp.q)} placeholder="Imóvel ou assunto" className={ESTILO_CAMPO_PADRAO} />
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <label htmlFor="f-g" className="text-xs font-semibold text-slate-600">Gravidade</label>
            <select id="f-g" name="g" defaultValue={g} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              <option value="critico">Crítico</option>
              <option value="atencao">Atenção</option>
            </select>
          </div>
          <div className="flex min-w-[170px] flex-1 flex-col gap-1">
            <label htmlFor="f-s" className="text-xs font-semibold text-slate-600">Secretaria</label>
            <select id="f-s" name="s" defaultValue={s} className={ESTILO_CAMPO_PADRAO}>
              <option value="">Todas</option>
              {t.secretarias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </div>
          {totalJustificadas > 0 && (
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="j" value="1" defaultChecked={mostrarJustificadas} />
              Mostrar justificadas ({totalJustificadas})
            </label>
          )}
        </FormularioFiltros>
        {lista.length === 0 ? (
          <Vazio>{t.todas.length === 0 ? "Nenhuma pendência. Tudo em ordem." : "Nenhuma pendência com esses filtros."}</Vazio>
        ) : (
          <ul className="flex flex-col gap-2 p-4 sm:p-5">
            {lista.map((p) => {
              const im = imovel.get(p.imovelId)!;
              const j = justif.get(`${p.imovelId}|${p.chave}|${p.assinatura}`);
              return (
                <li key={`${p.imovelId}-${p.chave}`} className={`flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 border-l-4 px-3 py-2.5 ${j ? "border-l-slate-300 opacity-80" : p.nivel === "critico" ? "border-l-red-600" : "border-l-amber-500"}`}>
                  <div className="min-w-0 flex-1 basis-72">
                    <p className="text-sm"><b>{im.nome}</b> · {p.titulo}</p>
                    <p className="text-[13px] text-slate-600">{p.detalhe}</p>
                    <p className="text-xs text-slate-500">{nomeSec.get(im.secretaria_id) ?? ""}</p>
                    {j && <p className="mt-1 text-[13px] text-slate-700"><b>Justificada</b> em {formatarData(j.em.slice(0, 10))}: {j.justificativa}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!j && <SeloGravidade nivel={p.nivel} />}
                    {gestor && <BotaoJustificar imovelId={p.imovelId} chave={p.chave} assinatura={p.assinatura} justificada={!!j} />}
                    <Link href={`/imoveis/imoveis/${p.imovelId}`} className="text-sm font-medium text-[color:var(--modulo-tinta)] hover:underline">Abrir imóvel</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}
