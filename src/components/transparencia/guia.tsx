"use client";

import { SITUACOES_PUBLICAS } from "@/lib/emendas/portal-agregados";
import { ORDEM_TIPOS, TIPOS_EXECUCAO } from "@/lib/emendas/fases";

import { SERIES } from "./graficos";
import { SeloSituacao } from "./selos";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--p-linha)] py-5 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-[var(--p-tinta)]">{titulo}</h3>
      <div className="flex flex-col gap-2 text-[14.5px] leading-relaxed text-[var(--p-tinta-2)]">{children}</div>
    </section>
  );
}

/** Guia de uso do portal, em linguagem simples (sem jargão sem explicação). */
export function GuiaPortal({ aoIniciarTour }: { aoIniciarTour: () => void }) {
  return (
    <div>
      <button type="button" onClick={aoIniciarTour} className="portal-botao mb-6 w-full">
        Fazer o tour guiado (1 minuto)
      </button>

      <Bloco titulo="O que são emendas impositivas">
        <p>
          Todo ano, cada vereador pode indicar como uma parte do orçamento do município será gasta: uma reforma, a compra de um equipamento, um repasse a uma entidade.
          São <strong>impositivas</strong> porque a Prefeitura é obrigada a executá-las, salvo impedimento técnico ou legal. Pelo menos metade vai para a saúde.
        </p>
        <p>Este portal mostra, para cada emenda, quem indicou, para quê, para quem, quanto já foi empenhado e quanto já foi pago — e se atualiza sozinho.</p>
      </Bloco>

      <Bloco titulo="Como ler o dinheiro">
        <ul className="flex flex-col gap-2.5">
          {SERIES.map((s) => (
            <li key={s.chave} className="flex gap-3">
              <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-[3px] ${s.classe}`} />
              <span>
                <strong className="text-[var(--p-tinta)]">{s.nome}.</strong> {s.explica}
              </span>
            </li>
          ))}
        </ul>
        <p>As três partes sempre somam o valor indicado da emenda. Passe o mouse (ou toque) em qualquer barra para ver os valores exatos.</p>
      </Bloco>

      <Bloco titulo="Situação de cada emenda">
        <ul className="flex flex-col gap-2.5">
          {SITUACOES_PUBLICAS.map((s) => (
            <li key={s.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <SeloSituacao s={s.chave} pequeno />
              <span>{s.explicacao}</span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Tipos de execução">
        <ul className="flex flex-col gap-2.5">
          {ORDEM_TIPOS.map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: `var(--t-${t})` }} />
              <span>
                <strong className="text-[var(--p-tinta)]">{TIPOS_EXECUCAO[t].nome}.</strong> {TIPOS_EXECUCAO[t].descricao}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Filtrar, ordenar e comparar">
        <p>Use as listas no topo: exercício, vereador, secretaria, tipo, situação e área. Tudo na página — números, gráficos e lista — muda na hora.</p>
        <p>Clicar numa barra (de um vereador, de uma secretaria, de um tipo ou de uma situação) também filtra. Clique de novo para tirar o filtro.</p>
        <p>O endereço da página guarda os filtros: copie o link para compartilhar exatamente o que você está vendo.</p>
      </Bloco>

      <Bloco titulo="Detalhe de uma emenda">
        <p>
          Toque numa emenda da lista para ver tudo o que a Instrução Normativa TCE-MG nº 05/2025 (art. 7º) manda divulgar: partido, lei do orçamento, objeto detalhado, localidade, cronograma,
          instrumentos e processo, recebedor e CNPJ, gestor responsável, GND, banco e conta, anuência do SUS, datas de cada empenho e pagamento, plano de trabalho e relatório de gestão.
        </p>
        <p>Quando um item ainda não foi informado pela gestão, ele aparece como &ldquo;Não informado&rdquo; — nada é escondido.</p>
      </Bloco>

      <Bloco titulo="Glossário">
        <dl className="grid gap-2">
          {[
            ["Empenho", "Reserva do dinheiro no orçamento para uma despesa específica. É o primeiro passo legal do gasto."],
            ["Liquidação", "Conferência de que o bem foi entregue ou o serviço foi prestado."],
            ["Pagamento", "Saída do dinheiro da conta da Prefeitura para quem forneceu ou para a entidade."],
            ["OSC", "Organização da sociedade civil (entidade sem fins lucrativos), que recebe por termo de fomento ou colaboração."],
            ["GND", "Grupo de natureza da despesa: separa despesas correntes (custeio) de investimentos (capital)."],
            ["Plano de trabalho", "Documento que descreve o objeto, as metas, o custo e o cronograma antes do repasse."],
            ["Relatório de gestão", "Prestação anual do que foi feito com o recurso, entregue até 30 de junho do ano seguinte."],
            ["Impedimento", "Motivo técnico, legal ou documental que impede executar a emenda como foi indicada."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold text-[var(--p-tinta)]">{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </Bloco>

      <Bloco titulo="Dados abertos e boletim">
        <p>No fim da página você baixa tudo em CSV (abre no Excel) ou JSON, para análise própria. Também pode cadastrar seu e-mail para receber, uma vez por dia, só o que mudou.</p>
      </Bloco>

      <Bloco titulo="Dúvidas e pedidos de informação">
        <p>Para pedir uma informação que não está aqui, use o Serviço de Informação ao Cidadão (e-SIC) ou a Ouvidoria da Prefeitura, nos termos da Lei de Acesso à Informação (Lei 12.527/2011).</p>
      </Bloco>
    </div>
  );
}
