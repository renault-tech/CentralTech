"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Campo, CLASSE_BOTAO, Mensagem } from "@/components/imoveis/ui";
import { salvarEntrega } from "@/lib/imoveis/actions";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";
import type { Entrega } from "@/types/imoveis";

const VAZIO = {
  avisoSaidaEm: "", aguaPedidoEm: "", aguaProtocolo: "", aguaDesligadaEm: "", luzPedidoEm: "", luzProtocolo: "", luzDesligadaEm: "",
  chavesEntreguesEm: "", chavesEntreguePor: "", chavesRecebidaPor: "", vistoriaAgendadaEm: "", vistoriador: "", vistoriaConcluidaEm: "", vistoriaObs: "",
  titularidadeAguaEm: "", titularidadeLuzEm: "", encerradoEm: "", observacoes: "",
};

/** Registro das etapas da entrega do imóvel: desligamentos, chaves, vistoria, troca de titularidade e encerramento. */
export function FormularioEntrega({ imovelId, entrega }: { imovelId: string; entrega: Entrega | null }) {
  const router = useRouter();
  const [v, setV] = React.useState({
    ...VAZIO,
    avisoSaidaEm: entrega?.aviso_saida_em ?? "",
    aguaPedidoEm: entrega?.agua_pedido_em ?? "",
    aguaProtocolo: entrega?.agua_protocolo ?? "",
    aguaDesligadaEm: entrega?.agua_desligada_em ?? "",
    luzPedidoEm: entrega?.luz_pedido_em ?? "",
    luzProtocolo: entrega?.luz_protocolo ?? "",
    luzDesligadaEm: entrega?.luz_desligada_em ?? "",
    chavesEntreguesEm: entrega?.chaves_entregues_em ?? "",
    chavesEntreguePor: entrega?.chaves_entregue_por ?? "",
    chavesRecebidaPor: entrega?.chaves_recebida_por ?? "",
    vistoriaAgendadaEm: entrega?.vistoria_agendada_em ?? "",
    vistoriador: entrega?.vistoriador ?? "",
    vistoriaConcluidaEm: entrega?.vistoria_concluida_em ?? "",
    vistoriaObs: entrega?.vistoria_obs ?? "",
    titularidadeAguaEm: entrega?.titularidade_agua_em ?? "",
    titularidadeLuzEm: entrega?.titularidade_luz_em ?? "",
    encerradoEm: entrega?.encerrado_em ?? "",
    observacoes: entrega?.observacoes ?? "",
  });
  const [erro, setErro] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pendente, iniciar] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const d = (k: keyof typeof v) => ({ value: v[k], onChange: set(k), className: ESTILO_CAMPO_PADRAO });

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    const n = (s: string) => s || null;
    iniciar(async () => {
      const r = await salvarEntrega({
        imovelId,
        avisoSaidaEm: n(v.avisoSaidaEm), aguaPedidoEm: n(v.aguaPedidoEm), aguaProtocolo: v.aguaProtocolo, aguaDesligadaEm: n(v.aguaDesligadaEm),
        luzPedidoEm: n(v.luzPedidoEm), luzProtocolo: v.luzProtocolo, luzDesligadaEm: n(v.luzDesligadaEm),
        chavesEntreguesEm: n(v.chavesEntreguesEm), chavesEntreguePor: v.chavesEntreguePor, chavesRecebidaPor: v.chavesRecebidaPor,
        vistoriaAgendadaEm: n(v.vistoriaAgendadaEm), vistoriador: v.vistoriador, vistoriaConcluidaEm: n(v.vistoriaConcluidaEm), vistoriaObs: v.vistoriaObs,
        titularidadeAguaEm: n(v.titularidadeAguaEm), titularidadeLuzEm: n(v.titularidadeLuzEm), encerradoEm: n(v.encerradoEm), observacoes: v.observacoes,
      });
      if (!r.sucesso) return setErro(r.erro);
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Aviso e desligamentos</legend>
        <Campo rotulo="Aviso de saída em" htmlFor="e-aviso"><input id="e-aviso" type="date" {...d("avisoSaidaEm")} /></Campo>
        <div className="hidden sm:block" /><div className="hidden sm:block" />
        <Campo rotulo="Água: pedido em" htmlFor="e-ap"><input id="e-ap" type="date" {...d("aguaPedidoEm")} /></Campo>
        <Campo rotulo="Água: protocolo" htmlFor="e-apr"><input id="e-apr" {...d("aguaProtocolo")} /></Campo>
        <Campo rotulo="Água: desligada em" htmlFor="e-ad"><input id="e-ad" type="date" {...d("aguaDesligadaEm")} /></Campo>
        <Campo rotulo="Luz: pedido em" htmlFor="e-lp"><input id="e-lp" type="date" {...d("luzPedidoEm")} /></Campo>
        <Campo rotulo="Luz: protocolo" htmlFor="e-lpr"><input id="e-lpr" {...d("luzProtocolo")} /></Campo>
        <Campo rotulo="Luz: desligada em" htmlFor="e-ld"><input id="e-ld" type="date" {...d("luzDesligadaEm")} /></Campo>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Chaves e vistoria</legend>
        <Campo rotulo="Chaves entregues em" htmlFor="e-ch"><input id="e-ch" type="date" {...d("chavesEntreguesEm")} /></Campo>
        <Campo rotulo="Quem entregou" htmlFor="e-che"><input id="e-che" {...d("chavesEntreguePor")} /></Campo>
        <Campo rotulo="Quem recebeu (imobiliária)" htmlFor="e-chr"><input id="e-chr" {...d("chavesRecebidaPor")} /></Campo>
        <Campo rotulo="Vistoria agendada para" htmlFor="e-va"><input id="e-va" type="date" {...d("vistoriaAgendadaEm")} /></Campo>
        <Campo rotulo="Vistoriador" htmlFor="e-vi"><input id="e-vi" {...d("vistoriador")} /></Campo>
        <Campo rotulo="Vistoria concluída em" htmlFor="e-vc"><input id="e-vc" type="date" {...d("vistoriaConcluidaEm")} /></Campo>
        <Campo rotulo="Resultado da vistoria" htmlFor="e-vo" className="sm:col-span-3"><textarea id="e-vo" rows={2} {...d("vistoriaObs")} /></Campo>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-cataguases-marinho">Titularidade e encerramento</legend>
        <Campo rotulo="Titularidade da água trocada em" htmlFor="e-ta"><input id="e-ta" type="date" {...d("titularidadeAguaEm")} /></Campo>
        <Campo rotulo="Titularidade da luz trocada em" htmlFor="e-tl"><input id="e-tl" type="date" {...d("titularidadeLuzEm")} /></Campo>
        <Campo rotulo="Contrato encerrado em" htmlFor="e-enc" dica="Só vale com tudo acima resolvido."><input id="e-enc" type="date" {...d("encerradoEm")} /></Campo>
        <Campo rotulo="Observações" htmlFor="e-obs" className="sm:col-span-3"><textarea id="e-obs" rows={2} {...d("observacoes")} /></Campo>
      </fieldset>
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      {ok && <Mensagem tipo="ok">Entrega salva.</Mensagem>}
      <div><button type="submit" disabled={pendente} className={CLASSE_BOTAO}>{pendente ? "Salvando…" : entrega ? "Salvar entrega" : "Iniciar entrega do imóvel"}</button></div>
    </form>
  );
}
