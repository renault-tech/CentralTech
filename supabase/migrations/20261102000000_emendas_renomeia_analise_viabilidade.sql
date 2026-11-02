-- Feedback de 02/11/2026 (Lenir Possani): item 2 de todos os fluxos de emendas
-- passa a se chamar "Análise de viabilidade técnica" (já aplicado em produção).
update emendas.fluxo_fases
   set nome = 'Análise de viabilidade técnica'
 where chave = 'analise' and nome = 'Análise técnica e de impedimento';
