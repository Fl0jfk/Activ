import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  images: {
    localPatterns: [
      { pathname: "/logo.png" },
      { pathname: "/favicon.ico" },
      { pathname: "/api/site-media/**" },
    ],
  },
};

export default nextConfig;
