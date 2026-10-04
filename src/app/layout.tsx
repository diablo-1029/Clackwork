import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import { appPath } from "@/lib/appPath";
import "./globals.css";

const title = "Clackwork — An Oddly Satisfying Factory Game";
const description =
  "Beat the clock in a tiny factory. Cut, stamp, polish, sort and pack as many products as you can before the shift ends, then beat your best.";
/** Where the game is published; share previews need full addresses. */
const SITE = "https://diablo-1029.github.io";
const shareImage = { url: appPath("/og.png"), width: 1200, height: 630, alt: "Clackwork" };

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Clackwork",
  metadataBase: new URL(SITE),
  icons: { apple: appPath("/icons/apple-touch-icon.png") },
  appleWebApp: { capable: true, title: "Clackwork", statusBarStyle: "black-translucent" },
  openGraph: { title, description, type: "website", siteName: "Clackwork", url: appPath("/"), images: [shareImage] },
  twitter: { card: "summary_large_image", title, description, images: [shareImage.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f7fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1424" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The saved UI mode is applied to <html> on the client, after hydration.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
