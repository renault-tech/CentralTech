-- Imóveis e Consumo: vínculo do imóvel com a Prefeitura. As planilhas de controle de água e luz cobrem TODOS os pontos de
-- consumo (alugados, próprios e cedidos), não só os alugados; sem este campo, tudo que entrasse viraria "aluguel de R$ 0".
-- Os imóveis que já existiam ficam "alugado" (default). Aplicado por MCP como `imoveis_07_vinculo`.
alter table imoveis.imoveis add column vinculo text not null default 'alugado' check (vinculo in ('alugado', 'proprio', 'cedido'));
create index imoveis_vinculo_idx on imoveis.imoveis (vinculo);

-- Contas importadas das planilhas de controle ficam marcadas como `planilha` (aplicado por MCP, em comando à parte).
alter table imoveis.contas drop constraint contas_origem_check, add constraint contas_origem_check check (origem in ('digitada', 'pdf', 'planilha'));
