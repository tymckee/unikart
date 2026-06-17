import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. The machine has a stray
  // package-lock.json in the home directory, which would otherwise make
  // Next infer the wrong workspace root.
  turbopack: {
    root: import.meta.dirname,
  },
  // Keep heavy/native server-only deps out of the bundle/trace:
  //  - imgly/onnxruntime: local-only background removal (dynamically imported).
  //  - prisma: the generated client + native query engine must be require()'d at
  //    runtime, not bundled — its createRequire usage otherwise trips the bundler
  //    and Netlify functions can't find the engine.
  serverExternalPackages: [
    "@imgly/background-removal-node",
    "onnxruntime-node",
    "@prisma/client",
    "prisma",
  ],
};

export default nextConfig;
