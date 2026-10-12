import type { NextConfig } from "next";

const esDev = process.env.NODE_ENV !== "production";
// upgrade-insecure-requests y HSTS solo donde hay HTTPS de verdad (Vercel); en `pnpm start` local romperían http://localhost.
const conHttps = !esDev && Boolean(process.env.VERCEL);

// Supabase: https para la API y wss por si se usa realtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabase = supabaseUrl ? [supabaseUrl, supabaseUrl.replace(/^https:/, "wss:")] : [];

// 'unsafe-inline' en scripts: Next.js inyecta scripts inline para hidratar y las páginas
// estáticas no pueden llevar nonce. Todo lo demás está cerrado a 'self' y a los orígenes de abajo.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:", // Montserrat sale de next/font: se sirve desde nuestro dominio
  `connect-src 'self' ${supabase.join(" ")}${esDev ? " ws://localhost:*" : ""}`.trim(),
  "frame-src https://www.youtube-nocookie.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(conHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const seguridad = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self "https://www.youtube-nocookie.com")',
  },
  // frame-ancestors ya está en la CSP; X-Frame-Options cubre navegadores viejos.
  { key: "X-Frame-Options", value: "DENY" },
  ...(conHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: seguridad },
      {
        // El service worker no se cachea para que las actualizaciones lleguen enseguida.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
