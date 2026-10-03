import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "./globals.css";

const title = "Clackwork — An Oddly Satisfying Factory Game";
const description =
  "Cut, stamp, polish, assemble, sort, and package products in a relaxing browser factory where every interaction is designed to feel satisfying.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Clackwork",
  openGraph: { title, description, type: "website", siteName: "Clackwork" },
  twitter: { card: "summary", title, description },
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
