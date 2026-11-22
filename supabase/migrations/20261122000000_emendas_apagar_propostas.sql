-- Aprovações: o gestor pode apagar propostas (pendentes, em conflito ou já decididas).
-- Antes só era possível aprovar ou rejeitar, e uma proposta em conflito ficava para sempre na lista.
grant delete on emendas.propostas to authenticated;

create policy gestor_apaga_propostas on emendas.propostas
  for delete using (emendas.eh_gestor());
