import type { NextConfig } from "next";

// The MVP has no backend: export a fully static site that any static host can serve.
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Pin the workspace root to this project; a lockfile higher up the tree would otherwise be picked.
  turbopack: { root: __dirname },
  // GitHub Pages serves the game from /<repository name>/; `npm run deploy` sets this. Empty everywhere else.
  basePath: process.env.PAGES_BASE_PATH || undefined,
};

export default nextConfig;
