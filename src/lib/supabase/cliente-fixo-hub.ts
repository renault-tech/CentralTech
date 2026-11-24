import { AsyncLocalStorage } from "node:async_hooks";

/** Token da pessoa durante uma leitura em cache do Hub (sem cookies disponíveis). Ver `lib/dados/cache-cabecalho.ts`. */
export const clienteFixoHub = new AsyncLocalStorage<{ token: string }>();
