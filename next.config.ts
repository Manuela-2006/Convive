import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.2.2"],
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.2.2"],
    },
  },
};

export default nextConfig;
