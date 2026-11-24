import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { AtualizarSozinho } from "@/components/layout/atualizar-sozinho";
import { ControleZoom } from "@/components/layout/controle-zoom";
import { ProvedorDialogos } from "@/components/ui/dialogos";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";
import { SCRIPT_ZOOM_INICIAL } from "@/lib/zoom";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Central Cataguases",
  description: "Painel central de acesso aos sistemas da Prefeitura de Cataguases.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0C1D33",
  // Claro e escuro são tratados pela própria plataforma (classe `dark` no <html>, ver `lib/tema.ts`).
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Conexão com o Supabase já aberta quando a página precisa dele (sessão, avisos ao vivo). */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />}
        {/* Aplica o tema salvo (ou o do sistema) antes da pintura, sem piscar. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        {/* Aplica o zoom salvo (limitado pela largura da tela) antes da pintura. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ZOOM_INICIAL }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ProvedorDialogos>
          {children}
          <AtualizarSozinho />
          {/* Só aparece onde não há cabeçalho (login, portal público…); com cabeçalho o botão é o dele. */}
          <ControleZoom variante="flutuante" />
        </ProvedorDialogos>
      </body>
    </html>
  );
}
