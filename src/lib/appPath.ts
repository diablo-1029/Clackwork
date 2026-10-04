/**
 * The folder the game is served from: empty locally, "/Clackwork" on GitHub Pages.
 * Set at build time by next.config.ts from the same value as `basePath`.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** A site-absolute path to one of our own files, under whatever folder the game is served from. */
export function appPath(path: string, base: string = BASE_PATH): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
