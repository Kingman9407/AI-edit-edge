import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in dev to cut memory (they can cost 2–4x the bundle size)
  productionBrowserSourceMaps: false,
  // Limit default in-memory cache to 50MB to avoid memory accumulation
  cacheMaxMemorySize: 52428800,
  // Automatically dispose page builds in development to free RAM
  onDemandEntries: {
    maxInactiveAge: 10 * 1000, // 10 seconds
    pagesBufferLength: 1,      // Keep only 1 page in memory at a time
  },
  // These packages are large WASM/AI libs — tell the server NOT to bundle them.
  // They are "use client" only, so the server has no reason to process them.
  serverExternalPackages: [
    "onnxruntime-web",
    "@huggingface/transformers",
    "@ffmpeg/ffmpeg",
    "@ffmpeg/util",
    "mediabunny",
  ],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Webpack memory footprint reduction (applies when turbopack is not used)
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
