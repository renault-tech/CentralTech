-- Configuração do exercício: perfis de secretaria podem (ou não) propor correção de número/data
-- de empenho, liquidação e pagamento. A correção sempre passa pela aprovação do gestor.
alter table emendas.exercicios add column if not exists secretaria_edita_lancamentos boolean not null default false;
