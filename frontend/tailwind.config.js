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
      /**
       * Type scale for the public site.
       *
       * Seven steps, each carrying its own leading. Display steps are set
       * tight because they only ever run at large sizes; reading steps are set
       * loose. Components use these names rather than arbitrary rem values, so
       * the scale can be retuned in one place.
       */
      fontSize: {
        "display-xl": ["4.25rem", { lineHeight: "1.0" }],
        "display-lg": ["3.5rem", { lineHeight: "1.04" }],
        display: ["2.5rem", { lineHeight: "1.08" }],
        "display-sm": ["2.125rem", { lineHeight: "1.1" }],
        title: ["1.75rem", { lineHeight: "1.18" }],
        "title-sm": ["1.375rem", { lineHeight: "1.25" }],
        heading: ["1.125rem", { lineHeight: "1.35" }],
        lead: ["1.1875rem", { lineHeight: "1.55" }],
        body: ["0.9375rem", { lineHeight: "1.65" }],
        "body-sm": ["0.875rem", { lineHeight: "1.6" }],
        caption: ["0.8125rem", { lineHeight: "1.55" }],
        micro: ["0.75rem", { lineHeight: "1.5" }],
        label: ["0.6875rem", { lineHeight: "1.4" }],
        "label-sm": ["0.625rem", { lineHeight: "1.3" }],
        "label-xs": ["0.5625rem", { lineHeight: "1.3" }],
      },
      /**
       * Kept separate from fontSize so a size can be reused untracked.
       *
       * Names are deliberately distinct from Tailwind's own `tight` /
       * `tighter`, which the dashboard and auth screens already use — those
       * keep their stock values.
       */
      letterSpacing: {
        display: "-0.035em",
        title: "-0.028em",
        heading: "-0.02em",
        snug: "-0.012em",
        label: "0.16em",
        "label-wide": "0.18em",
      },
      minHeight: {
        touch: "48px",
      },
      minWidth: {
        touch: "48px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom, 0px)",
        /** One vertical rhythm for every section band. */
        section: "5rem",
        "section-lg": "7rem",
      },
      maxWidth: {
        shell: "80rem",
        /** Comfortable measure for running prose, ~70 characters. */
        prose: "38rem",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
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
