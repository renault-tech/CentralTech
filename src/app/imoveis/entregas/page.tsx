import Link from "next/link";

import { EtapasEntrega } from "@/components/imoveis/etapas-entrega";
import { Cartao, SeloGravidade, SeloSituacaoImovel, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { formatarData, progressoEntrega } from "@/lib/imoveis/regras";

export const metadata = { title: "Entregas · Imóveis e Consumo" };

export default async function EntregasImoveis() {
  const t = await carregarTudo();
  const abertas = t.imoveis
    .filter((i) => i.situacao !== "ativo" || t.entregas.some((e) => e.id === i.id))
    .sort((a, b) => Number(a.situacao === "entregue") - Number(b.situacao === "entregue") || a.nome.localeCompare(b.nome));

  return (
    <>
      <TituloPagina titulo="Entregas de imóveis" subtitulo="A secretaria pede a saída e cuida do contrato. O Setor de Imóveis confere cada etapa e só encerra quando água e luz estão desligadas e a titularidade foi trocada." />
      {abertas.length === 0 ? (
        <Cartao><Vazio>Nenhuma entrega em andamento. Para iniciar, abra o imóvel e use a aba “Entrega”.</Vazio></Cartao>
      ) : (
        <div className="flex flex-col gap-4">
          {abertas.map((i) => {
            const e = t.entregas.find((x) => x.id === i.id) ?? null;
            const { feitas, total } = progressoEntrega(e);
            const critica = t.pendencias.some((p) => p.imovelId === i.id && p.nivel === "critico");
            return (
              <Cartao key={i.id} titulo={i.nome} apoio={`${i.endereco} · contrato ${i.contrato_numero ?? "—"} até ${formatarData(i.vigencia_fim)}`} acao={<span className="flex items-center gap-2"><SeloSituacaoImovel situacao={i.situacao} />{critica && <SeloGravidade nivel="critico" />}</span>}>
                <div className="mb-4 flex items-center gap-3 text-sm text-slate-600">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={feitas} aria-valuemin={0} aria-valuemax={total}><div className="h-full bg-[color:var(--modulo)]" style={{ width: `${(feitas / total) * 100}%` }} /></div>
                  <span className="tabular-nums">{feitas} de {total} etapas</span>
                </div>
                <EtapasEntrega entrega={e} />
                <p className="mt-4 text-sm"><Link href={`/imoveis/imoveis/${i.id}?aba=entrega`} className="font-medium text-[color:var(--modulo-tinta)] hover:underline">Abrir entrega do imóvel</Link></p>
              </Cartao>
            );
          })}
        </div>
      )}
    </>
  );
}
