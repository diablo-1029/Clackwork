import type { MetadataRoute } from "next";
import { appPath } from "@/lib/appPath";

// The site is a static export, so the manifest is written once at build time.
export const dynamic = "force-static";

/** Lets phones install the game to the home screen and open it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clackwork",
    short_name: "Clackwork",
    description: "Beat the clock in a tiny factory: cut, stamp, polish, sort and pack against a shift timer.",
    start_url: appPath("/"),
    scope: appPath("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a1424",
    theme_color: "#0f55a8",
    categories: ["games"],
    icons: [
      { src: appPath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: appPath("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: appPath("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
