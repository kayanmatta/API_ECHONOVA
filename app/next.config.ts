import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Configurações para melhor compatibilidade com Vercel
  poweredByHeader: false,
  compress: true,
  // Configurações importantes para Vercel
  serverExternalPackages: ["mongoose"],
  // Opcional: Configurar redirects ou rewrites se necessário
  // redirects: async () => [],
  // rewrites: async () => [],
};

export default nextConfig;