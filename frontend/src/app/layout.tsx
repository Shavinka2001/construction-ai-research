import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Leaflet's stylesheet is imported once here (not inside the dynamically
// imported map components) so it ships in the global CSS bundle instead of a
// per-chunk stylesheet that the browser can fail to fetch.
import "leaflet/dist/leaflet.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Construction AI — Pre-Construction Feasibility Portal",
    template: "%s | Construction AI",
  },
  description:
    "Intelligent pre-construction feasibility and cost analyzer for modern construction teams.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
