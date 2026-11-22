import { PainelAberturaImoveis } from "@/components/imoveis/painel-abertura";
import { Cartao, TituloPagina, Vazio } from "@/components/imoveis/ui";
import { obterContextoImoveis } from "@/lib/imoveis/dados";
import { carregarTudo } from "@/lib/imoveis/carregar";
import { montarPainelImoveis } from "@/lib/imoveis/painel-abertura";

export const metadata = { title: "Painel · Imóveis e Consumo" };

export default async function PainelImoveis() {
  const [dados, ctx] = await Promise.all([carregarTudo(), obterContextoImoveis()]);
  const { imoveis, unidades, contas, entregas, secretarias, pendencias, par, hoje } = dados;

  if (imoveis.length === 0) {
    return (
      <>
        <TituloPagina titulo="Painel" />
        <Cartao>
          <Vazio>Nenhum imóvel cadastrado ainda. Use “Imóveis” no menu para cadastrar o primeiro.</Vazio>
        </Cartao>
      </>
    );
  }

  const painel = montarPainelImoveis({ hoje, imoveis, unidades, contas, entregas, secretarias, pendencias, par });

  const fuso = "America/Sao_Paulo";
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const nome = ctx.situacao === "ok" ? ctx.usuario.nome.trim().split(/\s+/)[0] : "";
  const saudacao = `${hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}${nome ? `, ${nome}` : ""}.`;
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <PainelAberturaImoveis
      painel={painel}
      saudacao={saudacao}
      dataExtenso={dataExtenso}
    />
  );
}
