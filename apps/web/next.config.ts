import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure proper handling of API routes in dev mode
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Exclude pino from server-side bundling (it's a Node.js module)
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  
  // Empty turbopack config to allow the build to proceed
  turbopack: {},
};

export default nextConfig;
