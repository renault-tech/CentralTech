"use client";

import * as React from "react";

import { Campo } from "@/components/modulo/ui";
import { cepDoEndereco, mascararCep, montarEndereco, normalizarCep, type EnderecoCep } from "@/lib/cep";
import { consultarCep } from "@/lib/cep-actions";
import { ESTILO_CAMPO_PADRAO } from "@/lib/utils";

/**
 * Endereço com preenchimento pelo CEP. Digitou os 8 números: consulta sozinho (sem botão) e monta "Rua, número, complemento - Bairro -
 * Cidade/UF - CEP". Número e complemento atualizam o texto na hora. O campo "Endereço" continua editável à mão (e, se a pessoa mexer
 * nele, para de ser recomposto) e é ele que vai para o banco: o CEP fica dentro do texto, sem coluna nova.
 */
export function CampoEndereco({ valor, aoMudar, id = "endereco", rotulo = "Endereço" }: { valor: string; aoMudar: (endereco: string) => void; id?: string; rotulo?: string }) {
  const [cep, setCep] = React.useState(() => cepDoEndereco(valor));
  const [numero, setNumero] = React.useState("");
  const [complemento, setComplemento] = React.useState("");
  const [partes, setPartes] = React.useState<EnderecoCep | null>(null);
  const [estado, setEstado] = React.useState<{ tipo: "ok" | "erro" | "buscando"; texto: string } | null>(null);
  const ultimaConsulta = React.useRef<string>("");

  const recompor = (p: EnderecoCep, n: string, c: string) => aoMudar(montarEndereco({ ...p, numero: n, complemento: c }));

  async function consultar(cepDigitado: string) {
    const limpo = normalizarCep(cepDigitado);
    if (!limpo || limpo === ultimaConsulta.current) return;
    ultimaConsulta.current = limpo;
    setEstado({ tipo: "buscando", texto: "Buscando o endereço…" });
    const r = await consultarCep(limpo);
    if (ultimaConsulta.current !== limpo) return; // a pessoa já digitou outro CEP
    if (!r.sucesso) {
      ultimaConsulta.current = "";
      setPartes(null);
      return setEstado({ tipo: "erro", texto: r.erro });
    }
    setPartes(r.endereco);
    recompor(r.endereco, numero, complemento);
    setEstado({ tipo: "ok", texto: "Endereço preenchido pelo CEP. Informe o número." });
  }

  const campo = ESTILO_CAMPO_PADRAO;
  return (
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-6">
      <Campo rotulo="CEP" htmlFor={`${id}-cep`} className="sm:col-span-2" dica="Digite o CEP para preencher o endereço.">
        <input
          id={`${id}-cep`}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          className={campo}
          value={cep}
          onChange={(e) => {
            const m = mascararCep(e.target.value);
            setCep(m);
            if (normalizarCep(m)) void consultar(m);
            else {
              ultimaConsulta.current = "";
              setEstado(null);
            }
          }}
        />
      </Campo>
      <Campo rotulo="Número" htmlFor={`${id}-num`} className="sm:col-span-2">
        <input
          id={`${id}-num`}
          className={campo}
          value={numero}
          disabled={!partes}
          onChange={(e) => {
            setNumero(e.target.value);
            if (partes) recompor(partes, e.target.value, complemento);
          }}
        />
      </Campo>
      <Campo rotulo="Complemento" htmlFor={`${id}-comp`} className="sm:col-span-2">
        <input
          id={`${id}-comp`}
          className={campo}
          value={complemento}
          disabled={!partes}
          onChange={(e) => {
            setComplemento(e.target.value);
            if (partes) recompor(partes, numero, e.target.value);
          }}
        />
      </Campo>
      <Campo rotulo={rotulo} htmlFor={id} className="sm:col-span-6">
        <input
          id={id}
          required
          className={campo}
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value);
            setPartes(null); // editou à mão: não recompõe mais por cima
          }}
        />
      </Campo>
      {estado && (
        <p role={estado.tipo === "erro" ? "alert" : "status"} className={`text-xs sm:col-span-6 ${estado.tipo === "erro" ? "text-red-700" : estado.tipo === "ok" ? "text-green-800" : "text-slate-500"}`}>
          {estado.texto}
        </p>
      )}
    </div>
  );
}
