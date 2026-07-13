import type { NextConfig } from "next";

// For Docker / VPS builds we emit a self-contained standalone server
// (`node .next/standalone/server.js`). Enable it with BUILD_STANDALONE=1.
// Cloudflare Pages (@cloudflare/next-on-pages) must use the default output,
// so leave the env var unset for that build.
const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
};

export default nextConfig;
