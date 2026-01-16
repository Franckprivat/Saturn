import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Enable hot reload in Docker with polling
  // This is needed when running in Docker containers
  webpack: (config, { isServer }) => {
    if (!isServer && process.env.WATCHPACK_POLLING === 'true') {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
      };
    }
    return config;
  },
};

export default nextConfig;
