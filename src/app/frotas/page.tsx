import Link from "next/link";

import { calcularPainel, type ItemPendencia } from "@/lib/frotas/analise";
import { listarManutencoes, listarNotas, listarSecretarias, listarVeiculos, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { brl, formatarData, pct } from "@/lib/frotas/regras";
import { dataNoFuso } from "@/lib/fuso";
import { MenuExportar } from "@/components/emendas/menu-exportar";
import { opcoesExportar } from "@/lib/frotas/exportacao";
import { Barra, Cartao, CartaoNumero, CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO, SeloDias, SeloNivel, TituloPagina, Vazio } from "@/components/frotas/ui";

function Pendencias({
  itens,
  colunas,
  vazio,
  href,
}: {
  itens: ItemPendencia[];
  colunas: { titulo: string; valor: (i: ItemPendencia) => string }[];
  vazio: string;
  href: (i: ItemPendencia) => string;
}) {
  if (itens.length === 0) return <Vazio>{vazio}</Vazio>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            {colunas.map((c) => (
              <th key={c.titulo} scope="col" className="px-4 py-2.5 sm:px-5">
                {c.titulo}
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5 sm:px-5">
              Parado há
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
              {colunas.map((c, n) => (
                <td key={c.titulo} className="px-4 py-2.5 sm:px-5">
                  {n === 0 ? (
                    <Link href={href(i)} className="font-medium text-cataguases-marinho hover:underline">
                      {c.valor(i)}
                    </Link>
                  ) : (
                    c.valor(i)
                  )}
                </td>
              ))}
              <td className="px-4 py-2.5 sm:px-5">
                <SeloDias dias={i.dias} nivel={i.nivel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PainelFrotas() {
  const ctx = await obterContextoFrotas();
  const gestor = ctx.situacao === "ok" && ctx.gestor;
  const [veiculos, manutencoes, notas, secretarias, params] = await Promise.all([
    listarVeiculos(),
    listarManutencoes(),
    listarNotas(),
    listarSecretarias(),
    obterParametros(),
  ]);
  const hoje = dataNoFuso(new Date());
  const p = calcularPainel({ hoje, veiculos, manutencoes, notas, secretarias, params });
  const c = p.cartoes;
  const semDados = veiculos.length === 0;

  return (
    <>
      <TituloPagina
        titulo="Painel"
        subtitulo={`Situação dos documentos em ${formatarData(hoje)}. Alerta amarelo a partir de ${params.dias_atencao} dias parado na mesma etapa, vermelho a partir de ${params.dias_critico}.`}
        acao={
          <>
            <MenuExportar
              opcoes={opcoesExportar([
                { r: "pendencias", rotulo: "Pendências", formatos: ["xlsx", "pdf"] },
                { r: "contabilidade", rotulo: "Remessa à Contabilidade", formatos: ["pdf", "xlsx"] },
                { r: "completo", rotulo: "Tudo em uma planilha", formatos: ["xlsx"] },
              ])}
            />
            {gestor && (
              <>
                <Link href="/frotas/combustivel?novo=1" className={CLASSE_BOTAO}>
                  Lançar NF de combustível
                </Link>
                <Link href="/frotas/manutencao?novo=1" className={CLASSE_BOTAO_SECUNDARIO}>
                  Registrar orçamento
                </Link>
              </>
            )}
          </>
        }
      />

      {semDados && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ainda não há veículos cadastrados.{" "}
          {gestor ? (
            <Link href="/frotas/veiculos/importar" className="font-semibold underline">
              Importe a planilha de veículos
            </Link>
          ) : (
            "O Setor de Frotas precisa importar a planilha de veículos."
          )}
          .
        </div>
      )}

      <section aria-label="Resumo geral" data-tour="resumo-frotas" className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <CartaoNumero rotulo="NFs de combustível em andamento" valor={c.nfsEmAndamento} nota="Ainda não estão na Contabilidade" href="/frotas/combustivel" />
        <CartaoNumero
          rotulo="NFs aguardando retorno"
          valor={c.nfsAguardando}
          nota={c.nfsAguardandoComAlerta ? `${c.nfsAguardandoComAlerta} com ${params.dias_atencao} dias ou mais` : "Nenhuma com alerta"}
          href="/frotas/combustivel?sit=com_secretaria"
          destaque={c.nfsAguardandoComAlerta > 0}
        />
        <CartaoNumero rotulo="Manutenções com OC emitida" valor={c.manutComOc} nota="Em andamento, com OC do IPM" href="/frotas/manutencao" />
        <CartaoNumero
          rotulo="Manutenções aguardando NF"
          valor={c.manutAguardandoNf}
          nota={c.manutAguardandoNfComAlerta ? `${c.manutAguardandoNfComAlerta} com ${params.dias_atencao} dias ou mais` : "Nenhuma com alerta"}
          href="/frotas/manutencao?sit=aguardando"
          destaque={c.manutAguardandoNfComAlerta > 0}
        />
        <CartaoNumero
          rotulo="Orçamentos para analisar"
          valor={c.orcamentos}
          nota={c.orcamentoMaisAntigo !== null ? `O mais antigo está parado há ${c.orcamentoMaisAntigo} ${c.orcamentoMaisAntigo === 1 ? "dia" : "dias"}` : "Nenhum esperando"}
          href="/frotas/manutencao?sit=a_analisar"
        />
        <CartaoNumero rotulo="A enviar à Contabilidade" valor={c.paraContabilidade} nota="NFs assinadas e manutenções com documentos" href="/frotas/combustivel?sit=assinada" />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Cartao titulo="NFs de combustível que ainda não voltaram da secretaria" acao={<Link href="/frotas/combustivel" className="text-xs font-semibold text-[#3F5A12] hover:underline">Ver todas</Link>} semPadding>
            <Pendencias
              itens={p.nfsAguardando}
              colunas={[
                { titulo: "Secretaria", valor: (i) => i.secretaria },
                { titulo: "NF", valor: (i) => i.referencia },
                { titulo: "Enviada em", valor: (i) => formatarData(i.data) },
              ]}
              vazio="Nenhuma NF esperando retorno."
              href={(i) => `/frotas/combustivel?editar=${i.id}`}
            />
          </Cartao>

          <Cartao titulo="Manutenções aguardando a Nota Fiscal e os documentos" acao={<Link href="/frotas/manutencao" className="text-xs font-semibold text-[#3F5A12] hover:underline">Ver todas</Link>} semPadding>
            <Pendencias
              itens={p.manutencoesAguardando}
              colunas={[
                { titulo: "Secretaria", valor: (i) => i.secretaria },
                { titulo: "Veículo", valor: (i) => i.veiculo ?? "—" },
                { titulo: "OC", valor: (i) => i.referencia },
                { titulo: "Etapa", valor: (i) => i.rotulo ?? "" },
              ]}
              vazio="Nenhuma manutenção esperando NF."
              href={(i) => `/frotas/manutencao?id=${i.id}`}
            />
          </Cartao>

          <Cartao titulo="Orçamentos esperando a sua análise" acao={<Link href="/frotas/manutencao?sit=a_analisar" className="text-xs font-semibold text-[#3F5A12] hover:underline">Analisar</Link>} semPadding>
            <Pendencias
              itens={p.orcamentos}
              colunas={[
                { titulo: "Secretaria", valor: (i) => i.secretaria },
                { titulo: "Veículo", valor: (i) => i.veiculo ?? "—" },
                { titulo: "Serviço", valor: (i) => i.referencia },
                { titulo: "Valor", valor: (i) => brl(i.valor) },
              ]}
              vazio="Nenhum orçamento esperando análise."
              href={(i) => `/frotas/manutencao?id=${i.id}`}
            />
          </Cartao>
        </div>

        <div className="flex flex-col gap-6">
          <div data-tour="quinzena-frotas"><Cartao titulo={`Quinzena anterior (${p.quinzena.rotulo})`}>
            <p className="text-sm text-slate-600">Cada secretaria deve ter uma NF de combustível por quinzena.</p>
            {p.quinzena.esperadas === 0 ? (
              <Vazio>Nenhuma secretaria está marcada para controle de combustível. Ajuste em Configurações.</Vazio>
            ) : (
              <>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-cataguases-marinho">
                    {p.quinzena.recebidas} de {p.quinzena.esperadas}
                  </span>
                  <span className="text-xs text-slate-600">secretarias com NF recebida</span>
                </p>
                <div className="mt-2">
                  <Barra valor={(p.quinzena.recebidas / p.quinzena.esperadas) * 100} />
                </div>
                {p.quinzena.semNf.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-semibold text-slate-600">Ainda sem NF:</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.quinzena.semNf.map((nome) => (
                        <SeloNivel key={nome} nivel="critico" comPonto={false}>
                          {nome}
                        </SeloNivel>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Cartao></div>

          <Cartao titulo="Custo de manutenção × valor do veículo">
            <p className="text-sm text-slate-600">Manutenção dos últimos 12 meses em relação ao valor de referência (FIPE).</p>
            {p.alertasCusto.length === 0 ? (
              <Vazio>Nenhum veículo acima de {params.pct_atencao}% do valor.</Vazio>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {p.alertasCusto.map((l) => (
                  <li key={l.veiculo.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-cataguases-marinho">{l.veiculo.placa ?? "Sem placa"}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {l.veiculo.modelo} {l.veiculo.ano_modelo ?? ""}
                      </span>
                    </span>
                    <SeloNivel nivel={l.nivel}>{pct(l.pct12m)} do valor</SeloNivel>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/frotas/analise" className="mt-3 inline-block text-xs font-semibold text-[#3F5A12] hover:underline">
              Ver análise da frota
            </Link>
          </Cartao>
        </div>
      </div>
    </>
  );
}
