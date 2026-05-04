import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.2.2"],
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.2.2"],
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
