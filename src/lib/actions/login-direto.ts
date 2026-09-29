"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteNumeraAdmin } from "@/lib/supabase/numera-admin";
import type { Modulo } from "@/types/database";

export type ResultadoLoginDireto = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Liga/desliga o bloqueio de login direto de um app. Compras e
 * Requerimentos: só grava no bookkeeping do Hub (`config_modulo`), que a
 * checagem `esta_bloqueado_login_direto` de cada um já lê — mesmo projeto
 * Supabase, schema diferente.
 *
 * Numera é um projeto Supabase SEPARADO — não enxerga `config_modulo` do
 * Hub. A própria tela dele lê `app_config.loginDiretoBloqueado` no PRÓPRIO
 * banco (mesma tabela já usada para `secretaria_list`/
 * `secretariaPermissions`), então esta action também escreve lá com a
 * chave `service_role` (`criarClienteNumeraAdmin`, já usada para outras
 * escritas cross-projeto, como a criação de conta na aprovação de
 * solicitação de acesso). **Este toggle nem existia para o Numera até
 * agora** (comentário antigo aqui dizia "só Compras e Requerimentos têm um
 * substituto real, Numera é só leitura na UI") — deixou de ser verdade com
 * o SSO por magic link (clique em `abrirModulo` e a checagem silenciosa em
 * `/sso/silencioso`) construído nesta sessão: bloquear o login direto do
 * Numera agora tem, sim, um caminho de volta pelo Hub, igual aos outros
 * dois. Ver `PainelLoginDireto`.
 */
export async function alternarBloqueioLoginDireto(
  modulo: Modulo,
  bloqueado: boolean
): Promise<ResultadoLoginDireto> {
  const hub = await criarClienteServidor();
  const { error } = await hub.rpc("definir_bloqueio_login_direto", {
    p_modulo: modulo,
    p_bloqueado: bloqueado,
  });

  if (error) {
    console.error("[alternarBloqueioLoginDireto] falha:", error);
    return { sucesso: false, erro: error.message };
  }

  if (modulo === "numera") {
    try {
      const { error: erroNumera } = await criarClienteNumeraAdmin()
        .from("app_config")
        .upsert({ key: "loginDiretoBloqueado", value: bloqueado });
      if (erroNumera) {
        console.error("[alternarBloqueioLoginDireto] falha ao espelhar no Numera:", erroNumera);
        return {
          sucesso: false,
          erro: "Gravado no Hub, mas falhou ao espelhar no projeto do Numera — tente de novo.",
        };
      }
    } catch (e) {
      console.error("[alternarBloqueioLoginDireto] falha inesperada ao espelhar no Numera:", e);
      return {
        sucesso: false,
        erro: "Gravado no Hub, mas falhou ao espelhar no projeto do Numera — tente de novo.",
      };
    }
  }

  revalidatePath("/configuracoes");
  return { sucesso: true };
}
