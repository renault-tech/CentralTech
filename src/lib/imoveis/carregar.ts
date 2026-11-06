import "server-only";

import { cache } from "react";

import { dataNoFuso } from "@/lib/fuso";
import {
  listarContas,
  listarEntregas,
  listarImobiliarias,
  listarImoveis,
  listarJustificadas,
  listarSecretarias,
  listarUnidades,
  obterParametros,
} from "@/lib/imoveis/dados";
import { calcularPendencias, semJustificadas } from "@/lib/imoveis/regras";

/** Tudo o que as telas do módulo precisam, numa rodada só (e cacheado na requisição: layout e página dividem). */
export const carregarTudo = cache(async () => {
  const [imoveis, unidades, contas, entregas, justificadas, par, secretarias, imobiliarias] = await Promise.all([
    listarImoveis(),
    listarUnidades(),
    listarContas(),
    listarEntregas(),
    listarJustificadas(),
    obterParametros(),
    listarSecretarias(),
    listarImobiliarias(),
  ]);
  const hoje = dataNoFuso(new Date());
  const todas = calcularPendencias({ imoveis, unidades, contas, entregas, hoje, par });
  const pendencias = semJustificadas(todas, justificadas);
  return { imoveis, unidades, contas, entregas, justificadas, par, secretarias, imobiliarias, hoje, todas, pendencias };
});
