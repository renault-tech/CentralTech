import type { Metadata } from "next";
import { Suspense } from "react";

import { MolduraAuth } from "@/components/auth/moldura-auth";
import { FormularioLogin } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Entrar · Central Cataguases",
  description: "Acesso ao painel central dos sistemas da Prefeitura de Cataguases.",
};

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  desativado: "Sua conta foi desativada. Contate o administrador da plataforma.",
  link_invalido: "O link de recuperação é inválido ou expirou. Solicite um novo abaixo.",
  senha_redefinida: "Senha redefinida com sucesso. Entre com a sua nova senha.",
};

export default function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  return (
    <MolduraAuth titulo="Central Cataguases" subtitulo="Prefeitura de Cataguases">
      <Suspense fallback={<div className="h-[220px] w-full" />}>
        <MensagemMotivo searchParams={searchParams} />
        <FormularioLogin />
      </Suspense>
    </MolduraAuth>
  );
}

async function MensagemMotivo({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const mensagem = motivo ? MENSAGENS[motivo] : undefined;

  if (!mensagem) {
    return null;
  }

  const ehSucesso = motivo === "senha_redefinida";
  return (
    <p
      role="alert"
      className={
        ehSucesso
          ? "mb-4 rounded-md border border-semaforo-verde/40 bg-semaforo-verde/10 px-3 py-2 text-sm text-green-100"
          : "mb-4 rounded-md border border-semaforo-vermelho/40 bg-semaforo-vermelho/10 px-3 py-2 text-sm text-red-100"
      }
    >
      {mensagem}
    </p>
  );
}
