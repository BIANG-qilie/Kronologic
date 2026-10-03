import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Railway / container self-host (official Next.js deploy path).
  output: "standalone",
  // SQL migrations are read from disk at boot (src/instrumentation.ts), so ship them with the server.
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
  devIndicators: false,
};

export default nextConfig;
