import Link from "next/link";

import { MenuExportarFrotas } from "@/components/frotas/menu-exportar-frotas";
import { PainelAberturaFrotas } from "@/components/frotas/painel-abertura";
import { CLASSE_BOTAO, CLASSE_BOTAO_SECUNDARIO } from "@/components/frotas/ui";
import { listarManutencoes, listarNotas, listarSecretarias, listarVeiculos, obterContextoFrotas, obterParametros } from "@/lib/frotas/dados";
import { opcoesExportar } from "@/lib/frotas/exportacao";
import { montarPainelFrotas } from "@/lib/frotas/painel-abertura";
import { dataNoFuso } from "@/lib/fuso";

export const metadata = { title: "Painel · Frotas" };

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
  const painel = montarPainelFrotas({ hoje, veiculos, manutencoes, notas, secretarias, params });

  const fuso = "America/Sao_Paulo";
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const nome = ctx.situacao === "ok" ? ctx.usuario.nome.trim().split(/\s+/)[0] : "";
  const saudacao = `${hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}${nome ? `, ${nome}` : ""}.`;
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <PainelAberturaFrotas
      painel={painel}
      saudacao={saudacao}
      dataExtenso={dataExtenso}
      semVeiculos={veiculos.length === 0}
      gestor={gestor}
      acao={
        <>
          <MenuExportarFrotas
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
  );
}
