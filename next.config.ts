import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in dev to cut memory (they can cost 2–4x the bundle size)
  productionBrowserSourceMaps: false,
  // Limit default in-memory cache to 50MB to avoid memory accumulation
  cacheMaxMemorySize: 52428800,
  // Automatically dispose page builds in development to free RAM
  onDemandEntries: {
    maxInactiveAge: 15 * 1000, // 15 seconds
    pagesBufferLength: 2,      // Keep only 2 pages in memory
  },
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Webpack memory footprint reduction
    webpackMemoryOptimizations: true,
    // Disable preloading of all entrypoints on start to keep initial footprint minimal
    preloadEntriesOnStart: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
