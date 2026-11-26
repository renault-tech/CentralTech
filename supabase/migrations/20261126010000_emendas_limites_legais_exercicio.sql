-- Limites legais do exercício: % do teto das emendas e % máximo de restos a pagar (ambos sobre a RCL),
-- e o valor aprovado na lei (opcional). Só acrescenta. `rcl` e `percentual_rcl` já existiam.
alter table emendas.exercicios add column if not exists restos_teto_pct numeric(7,4)
  check (restos_teto_pct is null or (restos_teto_pct >= 0 and restos_teto_pct <= 100));
alter table emendas.exercicios add column if not exists aprovado_loa_valor numeric(14,2)
  check (aprovado_loa_valor is null or aprovado_loa_valor >= 0);
-- 2026 (definido pelo dono em 26/11/2026): teto 2% e restos a pagar 0,5% da RCL.
update emendas.exercicios set percentual_rcl = 2, restos_teto_pct = 0.5
 where ano = 2026 and percentual_rcl is null and restos_teto_pct is null;
