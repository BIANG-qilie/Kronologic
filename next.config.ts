import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Railway / container self-host (official Next.js deploy path).
  output: "standalone",
};

export default nextConfig;
