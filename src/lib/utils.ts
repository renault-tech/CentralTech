import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Classe padrão de input/select/textarea de formulário. */
export const ESTILO_CAMPO_PADRAO =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition-colors focus:border-cataguases-azul focus:ring-1 focus:ring-cataguases-azul";
