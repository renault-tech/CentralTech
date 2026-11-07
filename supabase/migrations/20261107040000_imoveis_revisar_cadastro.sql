-- Imóveis cadastrados a partir das planilhas de controle trazem só o que a planilha tem (nome do setor, endereço, código da
-- unidade e valores). O que ficou duvidoso ou ausente é anotado em `revisar_motivo` e aparece em Pendências ("Cadastro para
-- revisar") até o Setor de Imóveis marcar o imóvel como revisado (limpa o campo) ou justificar.
alter table imoveis.imoveis add column if not exists revisar_motivo text;
alter table imoveis.imoveis add constraint imoveis_revisar_motivo_tam check (revisar_motivo is null or length(revisar_motivo) <= 2000);
