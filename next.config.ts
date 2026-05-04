import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.2.2"],
  output: "standalone",
  turbopack: {
    resolveAlias: {
      "./test/unit/02-parser": "./app/backend/shims/empty-module.ts",
      "../test/unit/02-parser": "./app/backend/shims/empty-module.ts",
    },
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.2.2"],
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
