import type { NextConfig } from "next";
import path from "path";

const appDir = path.resolve(__dirname);
const localModules = path.join(appDir, "node_modules");

const nextConfig: NextConfig = {
  outputFileTracingRoot: appDir,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: appDir,
    resolveAlias: {
      tailwindcss: path.join(localModules, "tailwindcss"),
      "tw-animate-css": path.join(localModules, "tw-animate-css"),
    },
  },
};

export default nextConfig;
