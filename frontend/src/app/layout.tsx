import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
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

/**
 * Display face for landing-page headings (`font-display` in Tailwind).
 * Only the weights actually used are requested, and the body copy stays on
 * Inter, so the rest of the app is unaffected.
 */
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

/**
 * Monospace for figures, thresholds, branch names and file paths on the
 * landing page. Carrying measured values in a technical face rather than the
 * body font is what makes a spec read as a spec.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
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
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
