# Carga inicial do módulo Imóveis a partir das planilhas de 2026 (07/11/2026)

Registro de como os dados foram montados, para conferência posterior. A carga foi feita por SQL direto em produção
(projeto `nfijlzndlioefayctbsh`, schema `imoveis`), não pela tela de importação.

## Fontes
- `Energisa Total - 2026.xlsx` (luz) e `COPASA 2026 - atualizado.xlsx` (água), enviadas pelo dono. **Não estão no repositório.**
- Leitura com o mesmo código da tela de importação (`src/lib/imoveis/importacao/planilha-contas.ts`): uma aba por secretaria, vários blocos por
  aba, cabeçalho `CDC|Matrícula · Setor · Endereço · Jan…Dez`, segundo código da Energisa sem cabeçalho.
- Os números mensais são **valor em R$**, não kWh/m³: por isso `contas.valor` recebe o número e `consumo` fica nulo.

## Regras de montagem
1. **Ordem**: luz primeiro, água depois. Cada linha vira uma unidade (`unidades.tipo` = `luz`/`agua`, `numero` = código da planilha).
2. **Imóvel**: nome = coluna Setor; endereço = coluna Endereço (ou "Endereço não informado" se vazio). Uma linha cai num imóvel já criado quando,
   na mesma secretaria, o **nome é igual** (comparação sem acento/pontuação/caixa) ou o **endereço é igual e específico**
   (`enderecoEspecifico`: ≥ 12 caracteres, com número, e não "Rua Principal S/N" e parecidos). Senão cria imóvel novo. Resultado: 57 imóveis com água e luz.
3. **Secretaria**: pelo nome da aba (`secretariaDaAba`). Só a aba **SEDEGI** não tinha equivalente e criou a secretaria "SEDEGI".
   As 11 existentes: Administração, Agricultura, Assistência Social, Cultura, Educação, Esporte, Fazenda, Gabinete do Prefeito, Obras, Saúde, Serviços Urbanos.
4. **Vínculo**: todos `proprio`, aluguel 0 (a planilha não informa). Sem contrato, proprietário ou imobiliária.
5. **Contas**: um registro por unidade e mês com valor (`referencia` = dia 1, `origem = 'planilha'`), ano 2026. Célula vazia = sem conta.
   Sem vencimento nem pagamento (a planilha não traz).
6. **Observações do imóvel**: só o "segundo código da Energisa", quando existe. O texto de "Proj. Atividade" (dotação) **não** foi gravado.
7. **Ignorado**: 2 linhas da Fazenda na COPASA (parcelas de dívida do código 10374078, "valor juros/amortização"). O mesmo código existe como
   consumo normal no imóvel "PMC - Sede" (Administração) e esse foi importado.

## Totais gravados (conferidos no banco após a carga)
| Item | Valor |
|---|---|
| Secretarias novas | 1 (SEDEGI) |
| Imóveis | 245 |
| Unidades | 333 (luz 194, água 139) |
| Contas | 2.620 |
| Soma dos valores | R$ 1.718.884,83 |
| Imóveis com `revisar_motivo` | 245 (todos) |

## Campo `revisar_motivo` (pendência "Cadastro para revisar")
Migration `20261107040000_imoveis_revisar_cadastro.sql`. Uma dúvida por linha. Motivos gerados:
- **Vínculo/contrato/aluguel não informados** — todos os 245 (texto: "Planilha não informa o vínculo (próprio, alugado ou cedido), o contrato nem o aluguel; confirmar. Cadastrado como próprio.").
- **Endereço genérico ou ausente** — 107 imóveis (`enderecoEspecifico` falso).
- **Secretaria criada pela aba** — os imóveis da SEDEGI.
- **Possível duplicidade água × luz** — 27 pares, 51 imóveis (ver abaixo). Detecção por SQL: mesma secretaria, um imóvel só com luz e outro só com água,
  compartilhando um número de 2 a 5 dígitos no endereço **e** uma palavra de ≥ 5 letras (fora rua/praça/avenida/centro/escola/campo/secretaria/municipal/industrias)
  no nome ou endereço. **Não foram unificados** (o sistema ainda não tem como juntar imóveis).
- **Conta com valor R$ 0,00** — 2 imóveis (luz `1/3210162-8`, 4 meses zerados; água `15573443`, 1 mês).

### Pares marcados como possível duplicidade (luz × água)
Bolsa Familia × CAD Único Bolsa Família · Capela Mortuária / SERENO × Capela - Sereno · Centro Administrativo Municipal × Centro Administrativo ·
Centro de conv. idade feliz × CT. de Convivencia Idade Feilz · CTZ Imunização da Criança × NUCLEO ENDEMIAS · Dr. Hugo S. Lana (PSFTaquara Preta) × Dr. Hugo S. Lana (Psf Taquara Preta) ·
E.M Manoel D Siqueira × E.M Manoel Dutra Siqueira · E.M Prf Darcilia Guimarães × E.M Darcilia Guimarães · Escola m. cantinho feliz × E.M Cantinho Feliz ·
Ginásio Poliesportivo × Polo Esportivo · Infra Estrutura × Secretaria (Almoxarifado) · José Francisco Junqueira(PSF BANDEIRANTES II) × PSF BANDEIRANTES ·
José Q. Peixoto (VILA REIS) × José Q. Peixoto (PSF VILA REIS) · Mercado Produtor × Mercado do Produtor2 · Mercado Produtor × Mercado do Produtor ·
PM CTZ Sec. Fazenda × Secret. Da Fazenda · PM CTZ Secretaria de Esportes × *** · PM CTZ Sine 01/02/03 × SALA SINE 01/02/SINE SALA 03 ·
PM CTZ Sl Mineira 01 × SALA MINEIRA 01 · PM CTZ Sl Mineira 02 × SEDEGI · Prefeitura (Paço) × PMC - Sede · PSF PAMPUNHA (PROVISÓRIO) × PSF PAMPULHA ·
Sebastiao F. Santos(PSF LEONARDO) × PSF LEONARDO · Sec. Assistência Social (catrans) × Secretaria Assist. Social.
Falsos positivos possíveis: "CTZ Imunização da Criança × NUCLEO ENDEMIAS" (mesmo endereço, setores diferentes) e "Mercado Produtor" (luz) ligado a dois cadastros de água.

## Como conferir depois
```sql
select count(*) from imoveis.imoveis;                          -- 245
select tipo, count(*) from imoveis.unidades group by tipo;     -- luz 194, agua 139
select count(*), round(sum(valor),2) from imoveis.contas;      -- 2620, 1718884.83
select count(*) from imoveis.imoveis where revisar_motivo like '%genérico%';       -- 107
select count(*) from imoveis.imoveis where revisar_motivo like 'Possível duplicidade%'; -- 51
select count(*) from imoveis.contas where valor = 0;           -- contas zeradas
```
Para recompor a carga: rodar o leitor (`lerPlanilhaContas`) sobre os dois arquivos e aplicar as regras acima; a conferência de totais
por planilha existe em `src/lib/imoveis/importacao/planilhas-reais.test.ts` (`PLANILHAS_REAIS=/pasta npx vitest run …`).
O gerador usado na carga era um teste temporário e foi removido do repositório.

## Ressalvas
- Valores e endereços são os da planilha, sem correção (ortografia e caixa preservadas, ex.: "ADOLECENTE", "GRANAJARIA").
- Reimportar pela tela não sobrescreve mês já lançado e **pode duplicar imóveis** se o nome/endereço não casar com os já cadastrados.
- Nada disso foi aberto ainda no navegador com os dados reais.
