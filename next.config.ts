import type { NextConfig } from "next";
import packageJson from "./package.json";

// The MVP has no backend: export a fully static site that any static host can serve.
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Pin the workspace root to this project; a lockfile higher up the tree would otherwise be picked.
  turbopack: { root: __dirname },
  // GitHub Pages serves the game from /<repository name>/; `npm run deploy` sets this. Empty everywhere else.
  basePath: process.env.PAGES_BASE_PATH || undefined,
  // The same values, readable by the game itself (see src/lib/appPath.ts).
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH ?? "",
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;
