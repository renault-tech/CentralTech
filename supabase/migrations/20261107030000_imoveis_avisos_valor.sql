-- Imóveis e Consumo: aviso no sino para VALOR da conta acima do padrão, quando a conta não tem consumo informado (as planilhas de
-- controle de água e luz trazem só o valor mensal em reais). Mesmo desenho de `imoveis.avisar_pendencias`: só roda pelo agendador,
-- avisa os gestores, `chave_unica` por unidade e mês (não repete). Aplicado por MCP como `imoveis_08_avisos_valor`.
-- Agendamento: select cron.schedule('imoveis-avisar-valores', '10 11 * * *', 'select imoveis.avisar_valores()');  -- 8h10 em Brasília
-- Para desligar: select cron.unschedule('imoveis-avisar-valores');
-- (a função é criada com `create function`; o corpo está registrado no banco e na migration `imoveis_08_avisos_valor`)
revoke execute on function imoveis.avisar_valores() from public, anon, authenticated;
