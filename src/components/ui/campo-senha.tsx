"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão de mostrar/ocultar (olho). Sem estado
 * controlado: funciona com `name` dentro de qualquer form (server action).
 */
export function CampoSenha({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visivel, setVisivel] = React.useState(false);

  return (
    <div className="relative">
      <input
        type={visivel ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cataguases-dourado"
      >
        {visivel ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
