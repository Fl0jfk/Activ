import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.activsaintecroix.fr" }],
        destination: "https://activsaintecroix.fr/:path*",
        permanent: true,
      },
    ];
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
