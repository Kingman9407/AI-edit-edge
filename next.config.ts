import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in dev to cut memory (they can cost 2–4x the bundle size)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
