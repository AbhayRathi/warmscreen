import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure proper handling of API routes in dev mode
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
