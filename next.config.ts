import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. The machine has a stray
  // package-lock.json in the home directory, which would otherwise make
  // Next infer the wrong workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
  // Keep the heavy, native, local-only background-removal deps out of the
  // bundle/trace (they only run in dev; the cutout code dynamically imports them).
  serverExternalPackages: ["@imgly/background-removal-node", "onnxruntime-node"],
};

export default nextConfig;
