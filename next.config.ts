import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as rotas (feature 016 / SEC-005).
// HSTS já é injetado pela borda da Vercel, então não é duplicado aqui.
// O CSP restringe apenas frame-ancestors/base-uri/object-src/form-action —
// controles seguros que não quebram os scripts/estilos inline do Next. Um
// script-src estrito deve ser adotado em modo report-only antes de bloquear.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    // Sem default-src/script-src: essas diretivas cascateariam para os scripts
    // inline de hidratação do Next e imagens do R2, quebrando a aplicação.
    // Aqui ficam apenas diretivas isoladas seguras — frame-ancestors resolve o
    // clickjacking (equivalente ao X-Frame-Options acima).
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/vision", "@google/genai"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
