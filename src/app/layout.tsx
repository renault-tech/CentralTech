import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { AtualizarSozinho } from "@/components/layout/atualizar-sozinho";
import { SCRIPT_TEMA_INICIAL } from "@/lib/tema";

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
        {/* Aplica o tema salvo (ou o do sistema) antes da pintura, sem piscar. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
        <AtualizarSozinho />
      </body>
    </html>
  );
}
