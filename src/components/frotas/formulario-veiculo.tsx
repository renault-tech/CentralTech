"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { excluirVeiculo, marcarRevisaoCorreta, salvarVeiculo } from "@/lib/frotas/actions";
import { lerValor, valorParaCampo } from "@/lib/frotas/entrada";
import { tipoFipeSugerido } from "@/lib/frotas/fipe-parse";
import type { AvisoRevisao } from "@/lib/frotas/revisao";
import { brl, formatarData } from "@/lib/frotas/regras";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import { BuscaFipeVeiculo } from "@/components/frotas/busca-fipe";
import { Campo, CLASSE_BOTAO, CLASSE_BOTAO_PERIGO, CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";
import type { Classificacao, Combustivel, Fornecedor, SecretariaFrotas, SituacaoVeiculo, Veiculo, Vinculo } from "@/types/frotas";

const COMBUSTIVEIS: [Combustivel, string][] = [["gasolina", "Gasolina"], ["flex", "Flex"], ["diesel", "Diesel"], ["diesel_s10", "Diesel S10"]];
const CLASSIFICACOES: [Classificacao, string][] = [["leve", "Leve"], ["pesado", "Pesado"], ["maquina", "Máquina"], ["moto", "Moto"]];
const SITUACOES: [SituacaoVeiculo, string][] = [["ativo", "Ativo"], ["em_manutencao", "Em manutenção"], ["inativo", "Inativo"], ["baixado", "Baixado"]];
const VINCULOS: [Vinculo, string][] = [["proprio", "Próprio"], ["convenio", "Convênio"], ["alugado", "Alugado"]];

const numero = (v: string): number | null => (v.trim() && /^\d{4}$/.test(v.trim()) ? Number(v) : null);

export function FormularioVeiculo({
  veiculo,
  secretarias,
  locadoras,
  avisos,
  voltarPara,
}: {
  veiculo: Veiculo | null;
  secretarias: SecretariaFrotas[];
  locadoras: Fornecedor[];
  avisos: AvisoRevisao[];
  voltarPara: string;
}) {
  const router = useRouter();
  const [placa, setPlaca] = React.useState(veiculo?.placa ?? "");
  const [modelo, setModelo] = React.useState(veiculo?.modelo ?? "");
  const [marca, setMarca] = React.useState(veiculo?.marca ?? "");
  const [anoFab, setAnoFab] = React.useState(veiculo?.ano_fabricacao?.toString() ?? "");
  const [anoMod, setAnoMod] = React.useState(veiculo?.ano_modelo?.toString() ?? "");
  const [combustivel, setCombustivel] = React.useState<string>(veiculo?.combustivel ?? "");
  const [classificacao, setClassificacao] = React.useState<string>(veiculo?.classificacao ?? "");
  const [patrimonio, setPatrimonio] = React.useState(veiculo?.patrimonio ?? "");
  const [vinculo, setVinculo] = React.useState<Vinculo>(veiculo?.vinculo ?? "proprio");
  const [secretariaId, setSecretariaId] = React.useState(veiculo?.secretaria_id ?? "");
  const [setor, setSetor] = React.useState(veiculo?.setor ?? "");
  const [situacao, setSituacao] = React.useState<SituacaoVeiculo>(veiculo?.situacao ?? "ativo");
  const [motivo, setMotivo] = React.useState(veiculo?.motivo_situacao ?? "");
  const [finalidade, setFinalidade] = React.useState(veiculo?.finalidade ?? "");
  const [locadoraId, setLocadoraId] = React.useState(veiculo?.locadora_id ?? "");
  const [valor, setValor] = React.useState(valorParaCampo(veiculo?.valor_fonte === "manual" ? veiculo.valor_referencia : null));
  const [observacoes, setObservacoes] = React.useState(veiculo?.observacoes ?? "");
  const [erro, setErro] = React.useState<string | null>(null);
  const [pendente, iniciar] = React.useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const manual = lerValor(valor);
    if (Number.isNaN(manual)) return setErro("Confira o valor de referência (ex.: 72.000,00).");
    iniciar(async () => {
      const r = await salvarVeiculo({
        id: veiculo?.id,
        placa,
        modelo,
        marca,
        anoFabricacao: numero(anoFab),
        anoModelo: numero(anoMod),
        combustivel: (combustivel || null) as Combustivel | null,
        classificacao: (classificacao || null) as Classificacao | null,
        patrimonio,
        vinculo,
        secretariaId,
        setor,
        situacao,
        motivoSituacao: motivo,
        finalidade,
        locadoraId: vinculo === "alugado" ? locadoraId || null : null,
        // Só mexe no valor se a pessoa digitou algo (ou limpou o que era manual); o da FIPE não se perde ao salvar.
        valorManual: manual !== null ? manual : veiculo?.valor_fonte === "manual" ? null : undefined,
        observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      router.replace(voltarPara);
    });
  }

  function excluir() {
    if (!veiculo || !window.confirm(`Excluir o veículo ${veiculo.placa ?? veiculo.modelo}? O histórico da alteração fica registrado.`)) return;
    iniciar(async () => {
      const r = await excluirVeiculo(veiculo.id);
      if (!r.sucesso) return setErro(r.erro);
      router.replace(voltarPara);
    });
  }

  function correto(codigo: string) {
    if (!veiculo) return;
    iniciar(async () => {
      const r = await marcarRevisaoCorreta(veiculo.id, codigo);
      if (!r.sucesso) return setErro(r.erro);
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3.5">
      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[13px] font-semibold text-amber-900">Dados a revisar neste veículo</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {avisos.map((a) => (
              <li key={a.codigo} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
                <span>{a.texto}</span>
                <button type="button" disabled={pendente} onClick={() => correto(a.codigo)} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-semibold hover:bg-amber-100">
                  Está correto
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Placa (ou nº de frota)" htmlFor="v-placa" dica="Deixe em branco se não tiver.">
          <input id="v-placa" value={placa} onChange={(e) => setPlaca(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={20} />
        </Campo>
        <Campo rotulo="Patrimônio" htmlFor="v-patr">
          <input id="v-patr" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={30} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Modelo" htmlFor="v-modelo">
          <input id="v-modelo" required value={modelo} onChange={(e) => setModelo(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={160} />
        </Campo>
        <Campo rotulo="Marca" htmlFor="v-marca">
          <input id="v-marca" value={marca} onChange={(e) => setMarca(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={80} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Ano de fabricação" htmlFor="v-anof">
          <input id="v-anof" inputMode="numeric" value={anoFab} onChange={(e) => setAnoFab(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={4} />
        </Campo>
        <Campo rotulo="Ano do modelo" htmlFor="v-anom">
          <input id="v-anom" inputMode="numeric" value={anoMod} onChange={(e) => setAnoMod(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={4} />
        </Campo>
        <Campo rotulo="Combustível" htmlFor="v-comb">
          <select id="v-comb" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Não informado</option>
            {COMBUSTIVEIS.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Classificação" htmlFor="v-class">
          <select id="v-class" value={classificacao} onChange={(e) => setClassificacao(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Não informada</option>
            {CLASSIFICACOES.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Vínculo" htmlFor="v-vinc">
          <select id="v-vinc" value={vinculo} onChange={(e) => setVinculo(e.target.value as Vinculo)} className={ESTILO_CAMPO_PADRAO}>
            {VINCULOS.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Secretaria" htmlFor="v-sec">
          <select id="v-sec" required value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Escolha…</option>
            {secretarias.filter((s) => s.ativa || s.id === secretariaId).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Setor" htmlFor="v-setor" dica="Ex.: PSF, TFD, Defesa Civil.">
          <input id="v-setor" value={setor} onChange={(e) => setSetor(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={120} />
        </Campo>
      </div>
      {vinculo === "alugado" && (
        <Campo rotulo="Locadora" htmlFor="v-loc" dica={locadoras.length === 0 ? "Cadastre a locadora em Configurações." : undefined}>
          <select id="v-loc" required value={locadoraId} onChange={(e) => setLocadoraId(e.target.value)} className={ESTILO_CAMPO_PADRAO}>
            <option value="">Escolha…</option>
            {locadoras.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </Campo>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Situação" htmlFor="v-sit">
          <select id="v-sit" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoVeiculo)} className={ESTILO_CAMPO_PADRAO}>
            {SITUACOES.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Motivo da situação" htmlFor="v-mot" dica="Ex.: aguardando leilão, aguardando orçamento.">
          <input id="v-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={300} />
        </Campo>
      </div>
      <Campo rotulo="Finalidade" htmlFor="v-fin">
        <input id="v-fin" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} className={ESTILO_CAMPO_PADRAO} maxLength={500} />
      </Campo>

      <fieldset className="flex flex-col gap-2.5 border-t border-slate-100 pt-3.5">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Valor de referência</legend>
        {veiculo?.valor_referencia !== null && veiculo?.valor_referencia !== undefined ? (
          <p className="text-sm text-slate-700">
            Atual: <strong className="tabular-nums">{brl(veiculo.valor_referencia)}</strong> ·{" "}
            {veiculo.valor_fonte === "fipe" ? `tabela FIPE${veiculo.fipe_referencia ? ` (${veiculo.fipe_referencia})` : ""}` : `informado pelo setor${veiculo.valor_referencia_em ? ` em ${formatarData(veiculo.valor_referencia_em)}` : ""}`}
          </p>
        ) : (
          <p className="text-sm text-slate-600">Ainda sem valor. Sem ele, o veículo fica de fora da comparação custo × valor.</p>
        )}
        {veiculo && vinculo !== "alugado" && (
          <BuscaFipeVeiculo key={veiculo.id} veiculoId={veiculo.id} tipoInicial={tipoFipeSugerido({ classificacao: (classificacao || null) as Classificacao | null })} />
        )}
        {!veiculo && <p className="text-xs text-slate-500">Depois de salvar o veículo, dá para buscar o valor na tabela FIPE.</p>}
        <Campo rotulo="Ou informar o valor na mão" htmlFor="v-valor" dica="Para máquinas e veículos que a FIPE não cobre. Vale até alguém buscar na FIPE.">
          <input id="v-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={`${ESTILO_CAMPO_PADRAO} tabular-nums`} />
        </Campo>
      </fieldset>

      <Campo rotulo="Observações" htmlFor="v-obs">
        <textarea id="v-obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={2000} className={ESTILO_CAMPO_PADRAO} />
      </Campo>

      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pendente} className={CLASSE_BOTAO}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={() => router.replace(voltarPara)} className={CLASSE_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
        {veiculo && (
          <button type="button" onClick={excluir} disabled={pendente} className={`${CLASSE_BOTAO_PERIGO} ml-auto`}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
