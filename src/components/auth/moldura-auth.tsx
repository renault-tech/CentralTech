import { Brasao } from "@/components/brasao";

/**
 * Moldura visual compartilhada das telas de autenticação (login,
 * recuperar senha, redefinir senha): fundo institucional, brasão e título.
 */
export function MolduraAuth({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-cataguases-marinho px-6 py-16 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37, 99, 168, 0.35), transparent 70%), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(16, 42, 71, 0.9), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(233,166,59,1) 1px, transparent 1px), linear-gradient(90deg, rgba(233,166,59,1) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div
          className="flex flex-col items-center text-center animar-entrada"
          style={{ animationDelay: "0ms" }}
        >
          <Brasao tamanho={84} />
          <div className="mt-6 h-px w-20 bg-gradient-to-r from-transparent via-cataguases-dourado to-transparent" />
          <h1 className="mt-6 text-2xl font-light tracking-tight text-white">
            {titulo}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{subtitulo}</p>
        </div>

        <div
          className="mt-8 w-full animar-entrada"
          style={{ animationDelay: "140ms" }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
