import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. The machine has a stray
  // package-lock.json in the home directory, which would otherwise make
  // Next infer the wrong workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
