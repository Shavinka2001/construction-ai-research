/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1E1E24",
        },
        // Legacy surface palette — used across auth + dashboard. Do not remove.
        charcoal: {
          DEFAULT: "#1E1E24",
          light: "#2A2A32",
          dark: "#141418",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E4C65A",
          dark: "#B8942E",
          muted: "rgba(212, 175, 55, 0.15)",
        },
        // "Industrial Luxury" landing palette.
        ink: {
          DEFAULT: "#0F172A",
          deep: "#080D19",
          light: "#1B2437",
          line: "rgba(148, 163, 184, 0.16)",
        },
        emerald: {
          brand: "#10B981",
          "brand-dark": "#059669",
          "brand-muted": "rgba(16, 185, 129, 0.14)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
      },
      maxWidth: {
        shell: "80rem",
      },
      boxShadow: {
        luxury: "0 4px 24px -4px rgba(30, 30, 36, 0.08)",
        "luxury-lg": "0 8px 40px -8px rgba(30, 30, 36, 0.12)",
        "glow-gold": "0 0 0 1px rgba(212, 175, 55, 0.35), 0 12px 40px -12px rgba(212, 175, 55, 0.45)",
        "glow-emerald": "0 0 0 1px rgba(16, 185, 129, 0.3), 0 12px 40px -12px rgba(16, 185, 129, 0.4)",
        "inset-hairline": "inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "trace-flow": {
          from: { strokeDashoffset: "48" },
          to: { strokeDashoffset: "0" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.6", transform: "scale(0.85)" },
          "70%": { opacity: "0", transform: "scale(1.6)" },
          "100%": { opacity: "0", transform: "scale(1.6)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.4s ease-in-out infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
        "trace-flow": "trace-flow 1.4s linear infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};
