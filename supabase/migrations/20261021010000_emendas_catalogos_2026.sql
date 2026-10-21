-- Catálogos iniciais do módulo Emendas, conforme a planilha "Emendas
-- Impositivas 2026" usada até aqui pela gestão: 15 vereadores com cota
-- igual de R$ 343.832,67 (total R$ 5.157.490,05) e as 13 unidades
-- orçamentárias que aparecem nela. Secretarias = a mesma lista canônica de
-- requerimentos.secretarias (unidade de permissão do módulo).

insert into emendas.exercicios (ano, cota_por_vereador, percentual_saude_min)
values (2026, 343832.67, 50)
on conflict (ano) do nothing;

insert into emendas.secretarias (nome, ordem) values
  ('Gabinete', 1),
  ('Administração', 2),
  ('Agricultura e Meio Ambiente', 3),
  ('Cultura e Turismo', 4),
  ('Desenvolvimento Econômico', 5),
  ('Desenvolvimento Social', 6),
  ('Educação', 7),
  ('Esporte', 8),
  ('Fazenda', 9),
  ('Obras', 10),
  ('Procuradoria', 11),
  ('Saúde', 12),
  ('Serviços Urbanos', 13),
  ('Serviços Urbanos/CATRANS', 14)
on conflict (nome) do nothing;

insert into emendas.unidades_orcamentarias (codigo, nome, secretaria_id)
select v.codigo, v.nome, s.id
from (values
  ('02.01', 'Gabinete', 'Gabinete'),
  ('02.02', 'Administração', 'Administração'),
  ('02.06', 'Desenvolvimento Social', 'Desenvolvimento Social'),
  ('02.07', 'Fundo de Desenvolvimento Social', 'Desenvolvimento Social'),
  ('02.08', 'Saúde', 'Saúde'),
  ('02.09', 'Fundo de Saúde', 'Saúde'),
  ('02.10', 'Educação', 'Educação'),
  ('02.11', 'Cultura', 'Cultura e Turismo'),
  ('02.12', 'Obras', 'Obras'),
  ('02.13', 'Serviços Urbanos', 'Serviços Urbanos'),
  ('02.14', 'Fundo de Transporte', 'Serviços Urbanos/CATRANS'),
  ('02.15', 'Agricultura e Meio Ambiente', 'Agricultura e Meio Ambiente'),
  ('02.17', 'Esportes', 'Esporte')
) as v(codigo, nome, secretaria)
join emendas.secretarias s on s.nome = v.secretaria
on conflict (codigo) do nothing;

insert into emendas.vereadores (numero, nome) values
  (1, 'Ana Cristina dos Santos Romão'),
  (2, 'Antônio Gilmar de Oliveira'),
  (3, 'Carlos Magno de Melo Nóbrega'),
  (4, 'Felipe Ramos Vilas de Souza'),
  (5, 'Fernando Medeiros Pereira'),
  (6, 'Flávio Alves de Sousa'),
  (7, 'Giovana Costa'),
  (8, 'Giovanni Gropo Toledo'),
  (9, 'Henrique Silva Oliveira'),
  (10, 'Josimar Branquinho de Almeida'),
  (11, 'Júnio Valentim'),
  (12, 'Marcos da Costa Garcia'),
  (13, 'Ricardo Geraldo Dias'),
  (14, 'Vinícius Machado'),
  (15, 'Willian José Lourenço Jerônimo')
on conflict (numero) do nothing;
