import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Barrel imports (recharts, lucide-react, framer-motion) pull far more than
  // the used members without this — it rewrites them to per-module imports.
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react", "framer-motion"],
  },
  // Hashed build assets are immutable; tell every cache in the chain so they
  // are never revalidated. Production only: in dev, chunk URLs are rewritten
  // on every edit and a stale immutable entry serves dead code. API responses
  // carry their own per-action Cache-Control from the route and must not be
  // touched here.
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // src/db/env.ts resolves the database path from process.cwd(), which makes
  // Turbopack's file tracer pull in the entire project — including db/custom.db
  // — for the /api/lexilearn route. That both bloats the standalone bundle and
  // ships a build-time snapshot of the study database, which a server started
  // from inside .next/standalone would then use *instead of* the live one.
  // env.ts now refuses .next/ paths as a second line of defence; these excludes
  // keep the rest of the project out of the trace.
  //
  // Note: `.env` is deliberately NOT listed. Next copies it into the standalone
  // output itself so the server can read config at runtime, and every var in it
  // has a code-level fallback. That makes .env the one file that does ship —
  // so keep real secrets out of it and pass those via the environment instead.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  outputFileTracingExcludes: {
    "/api/lexilearn": [
      "./db/**/*",
      "db/**/*",
      "./src/**/*",
      "./tests/**/*",
      "./scripts/**/*",
      "./*.md",
      "./dev.log",
      "./tsconfig.tsbuildinfo",
      "./drizzle.config.ts",
      "./components.json",
    ],
  },
};

export default nextConfig;
