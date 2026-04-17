import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluye los archivos de contexto en el bundle de la API route de Netlify
  outputFileTracingIncludes: {
    "/api/generate": ["./context/**/*"],
  },
};

export default nextConfig;
