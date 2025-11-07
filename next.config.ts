import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔹 Habilita React Strict Mode
  reactStrictMode: true,

  // 🔹 Experimental: ativa Turbopack (Next.js 16+)
  experimental: {
    turbo: {
      rules: {
        "*.ts": ["ts-loader"],
        "*.tsx": ["ts-loader"],
      },
    },
  },

  // 🔹 Ajuste de resolução e saída para ESM
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
    };
    config.output.module = true;
    config.experiments = { ...config.experiments, outputModule: true };
    return config;
  },

  // 🔹 Configuração de imagens externas (caso use)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // 🔹 Variáveis de ambiente públicas (caso use Supabase)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
