import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.wasm": {
        type: "asset",
      },
    },
  },

  // Webpack fallback — only applies if Turbopack is disabled (e.g. `next build --no-turbopack`).
  // `next build`/`next dev` default to Turbopack in Next 16, which uses the `turbopack.rules` above instead.
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
