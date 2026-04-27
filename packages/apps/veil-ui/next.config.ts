import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  transpilePackages: ["@veil/veil-contract"],
  // Keep midnight-js-contracts out of the SSR bundle — it uses Node.js APIs
  // (fs/path) that are fine at runtime in Node but must never be SSR-bundled.
  serverExternalPackages: ["@midnight-ntwrk/midnight-js-contracts"],
  // Turbopack (default in Next.js 16): stub bare `import 'fs'` side-effect
  // that midnight-js-contracts ships but never actually calls.
  // Path must be relative to the project root — no path.resolve().
  turbopack: {
    resolveAlias: {
      fs: "./stubs/empty-node-module.js",
    },
  },
};

export default nextConfig;
