-- Teto de restos a pagar do exercício (R$): o máximo que pode ficar empenhado e não pago em 31/12.
-- Vazio = não informado (o painel mostra "limite não informado"). Só acrescenta.
alter table emendas.exercicios add column if not exists restos_teto_valor numeric(14,2)
  check (restos_teto_valor is null or restos_teto_valor >= 0);
