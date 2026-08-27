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
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
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
      boxShadow: {
        luxury: "0 4px 24px -4px rgba(30, 30, 36, 0.08)",
        "luxury-lg": "0 8px 40px -8px rgba(30, 30, 36, 0.12)",
      },
    },
  },
  plugins: [],
};
