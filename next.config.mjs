/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Importação da planilha de emendas (Server Action com o .xlsx): o
    // limite padrão de 1 MB é apertado para uma planilha anual com
    // descrições longas.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
