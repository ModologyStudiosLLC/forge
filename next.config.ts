import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow OpenCascade WASM
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Suppress "Critical dependency" warning from opencascade dynamic require
    config.module.rules.push({
      test: /opencascade\.js/,
      type: "javascript/auto",
    });

    return config;
  },

  // Required for three.js / r3f canvas
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
