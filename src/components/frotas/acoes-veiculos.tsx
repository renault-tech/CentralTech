"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { atualizarValoresFipe, ligarVeiculosFipe, type RodadaLigarFipe } from "@/lib/frotas/actions-importacao";
import { CLASSE_BOTAO_SECUNDARIO, Mensagem } from "@/components/frotas/ui";

type Msg = { tipo: "ok" | "erro" | "aviso"; texto: string };
type SemLigacao = RodadaLigarFipe["semLigacao"];
type Aproximados = RodadaLigarFipe["aproximados"];

/**
 * Valores da FIPE: "Ligar veículos à FIPE" procura sozinho a marca/modelo/ano de quem ainda não tem vínculo
 * e grava o valor; "Atualizar valores" refaz o valor dos já ligados (uma vez por mês). As duas repetem
 * rodadas curtas sozinhas, para caber no tempo da função, e mostram o motivo quando algo falha.
 */
export function AtualizarFipe() {
  const router = useRouter();
  const [pendente, iniciar] = React.useTransition();
  const [msg, setMsg] = React.useState<Msg | null>(null);
  const [progresso, setProgresso] = React.useState<string | null>(null);
  const [semLigacao, setSemLigacao] = React.useState<SemLigacao>([]);
  const [aproximados, setAproximados] = React.useState<Aproximados>([]);

  function atualizar() {
    setMsg(null);
    setSemLigacao([]);
    setAproximados([]);
    iniciar(async () => {
      let atualizados = 0;
      let falhas = 0;
      let motivo: string | null = null;
      for (let i = 0; i < 40; i += 1) {
        setProgresso(`Atualizando… ${atualizados} feitos`);
        let r: Awaited<ReturnType<typeof atualizarValoresFipe>>;
        try {
          r = await atualizarValoresFipe();
        } catch {
          setProgresso(null);
          return setMsg({ tipo: "erro", texto: `${atualizados} atualizados. A consulta foi interrompida (tempo esgotado ou sem conexão); clique de novo para continuar.` });
        }
        if (!r.sucesso) {
          setProgresso(null);
          return setMsg({ tipo: "erro", texto: r.erro });
        }
        atualizados += r.atualizados;
        falhas += r.falhas;
        motivo ??= r.motivo;
        if (r.parar || r.restantes === 0 || (r.atualizados === 0 && r.falhas > 0)) break;
      }
      setProgresso(null);
      const partes = [`${atualizados} atualizados`];
      if (falhas) partes.push(`${falhas} com falha`);
      const texto = partes.join(" · ") + "." + (motivo ? ` ${motivo}` : atualizados === 0 && falhas === 0 ? " Todos os veículos ligados à FIPE já estão com o valor deste mês." : "");
      setMsg({ tipo: motivo && !atualizados ? "erro" : falhas ? "aviso" : "ok", texto });
      router.refresh();
    });
  }

  function ligar() {
    setMsg(null);
    setSemLigacao([]);
    setAproximados([]);
    iniciar(async () => {
      let ligados = 0;
      let motivo: string | null = null;
      const pendentes: SemLigacao = [];
      const aprox: Aproximados = [];
      const ignorar: string[] = [];
      for (let i = 0; i < 80; i += 1) {
        setProgresso(`Ligando à FIPE… ${ligados} ligados, ${pendentes.length} para escolher na mão`);
        let r: Awaited<ReturnType<typeof ligarVeiculosFipe>>;
        try {
          r = await ligarVeiculosFipe({ ignorar });
        } catch {
          setProgresso(null);
          setSemLigacao(pendentes);
          setAproximados(aprox);
          return setMsg({ tipo: "erro", texto: `${ligados} ligados. A consulta foi interrompida (tempo esgotado ou sem conexão); clique de novo para continuar.` });
        }
        if (!r.sucesso) {
          setProgresso(null);
          setSemLigacao(pendentes);
          setAproximados(aprox);
          return setMsg({ tipo: "erro", texto: r.erro });
        }
        ligados += r.ligados;
        motivo ??= r.motivo;
        aprox.push(...r.aproximados);
        for (const p of r.semLigacao) {
          pendentes.push(p);
          ignorar.push(p.id);
        }
        if (r.parar || r.restantes === 0) break;
        if (r.ligados === 0 && r.semLigacao.length === 0) break;
      }
      setProgresso(null);
      setSemLigacao(pendentes);
      setAproximados(aprox);
      const partes = [`${ligados} ligados à FIPE`];
      if (aprox.length) partes.push(`${aprox.length} por aproximação (confira a lista)`);
      if (pendentes.length) partes.push(`${pendentes.length} para escolher na mão (veja a lista)`);
      setMsg({ tipo: motivo ? (ligados ? "aviso" : "erro") : pendentes.length ? "aviso" : "ok", texto: partes.join(" · ") + "." + (motivo ? ` ${motivo}` : "") });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={ligar} disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>
          Ligar veículos à FIPE
        </button>
        <button type="button" onClick={atualizar} disabled={pendente} className={CLASSE_BOTAO_SECUNDARIO}>
          Atualizar valores da FIPE
        </button>
      </div>
      {progresso && <p role="status" className="text-xs text-slate-600">{progresso}</p>}
      {msg && <Mensagem tipo={msg.tipo}>{msg.texto}</Mensagem>}
      {aproximados.length > 0 && (
        <details className="w-full max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">Ligados por aproximação — confira a versão ({aproximados.length})</summary>
          <p className="mt-1.5">O cadastro era curto e várias versões da FIPE serviam; foi escolhida a de nome mais curto. Se a versão estiver errada, corrija em Veículos → editar → &quot;Procurar na FIPE&quot;.</p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {aproximados.map((v) => (
              <li key={v.id}>
                <span className="font-semibold">{v.placa ?? "Sem placa"}</span> · {v.modelo} → {v.escolhido}
              </li>
            ))}
          </ul>
        </details>
      )}
      {semLigacao.length > 0 && (
        <details className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">Veículos que precisam de escolha na mão ({semLigacao.length})</summary>
          <p className="mt-1.5 text-slate-500">Abra o veículo em Veículos → editar → &quot;Procurar na FIPE&quot;.</p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {semLigacao.map((v) => (
              <li key={v.id}>
                <span className="font-semibold">{v.placa ?? "Sem placa"}</span> · {v.modelo} — {v.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
