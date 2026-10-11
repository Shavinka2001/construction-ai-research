import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
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
 * Display face for the public site (`font-display` in Tailwind).
 *
 * A high-contrast serif rather than another geometric sans: it separates this
 * from the default product-site look and suits an architectural subject. It
 * ships a single regular weight, which carries at display sizes but reads thin
 * below them, so smaller headings stay on the sans stack.
 *
 * Body copy remains on Inter, so the dashboard and auth screens are unchanged.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
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
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
