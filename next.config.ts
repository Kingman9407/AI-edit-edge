import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce dev-server memory: don't watch inside node_modules
  watchOptions: {
    ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
  },
  // Disable source maps in dev to cut memory (they can cost 2–4x the bundle size)
  productionBrowserSourceMaps: false,
};

export default nextConfig;

