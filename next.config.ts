import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (default in Next.js 16) handles WASM natively — no config needed
  turbopack: {},

  // Webpack fallback (used in production builds)
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },

  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
