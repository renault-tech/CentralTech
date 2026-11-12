-- Exclusão justificada também vale para andamentos (desfazer um andamento registrado por engano).
alter table emendas.exclusoes_justificadas drop constraint if exists exclusoes_justificadas_tipo_check;
alter table emendas.exclusoes_justificadas drop constraint if exists exclusoes_justificadas_tipo_check2;
alter table emendas.exclusoes_justificadas add constraint exclusoes_justificadas_tipo_check check (tipo = any (array['lancamento','emenda','andamento']));
