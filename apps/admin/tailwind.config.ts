import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        primary: {
          50:  "#E8F7E8",
          100: "#D1F0D1",
          200: "#A3E0A3",
          300: "#75D175",
          400: "#4CCB2A",
          500: "#008A3A",
          600: "#007D34",
          700: "#006B2E",
          800: "#005926",
          900: "#00471E",
          DEFAULT: "#008A3A",
          dark: "#006B2E",
        },
        zika: {
          navy:    "#006B2E",
          "navy-light": "#008A3A",
          gold:    "#A3D977",
          teal:    "#4CCB2A",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle:  "#F6FBF6",
          muted:   "#f1f5f9",
          dark:    "#0f172a",
        },
        border: {
          DEFAULT: "#e2e8f0",
          strong:  "#cbd5e1",
        },
        success: {
          DEFAULT: "#008A3A",
          light:   "#E8F7E8",
          dark:    "#006B2E",
        },
        warning: {
          DEFAULT: "#A3D977",
          light:   "#F6FBF6",
          dark:    "#3A5E20",
        },
        danger: {
          DEFAULT: "#ef4444",
          light:   "#fee2e2",
          dark:    "#7f1d1d",
        },
        info: {
          DEFAULT: "#4CCB2A",
          light:   "#E8F7E8",
          dark:    "#006B2E",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        "card-md": "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        "card-lg": "0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)",
        drawer: "rgba(0, 0, 0, 0.15) -4px 0 20px",
        "glow-primary": "0 0 0 3px rgb(0 138 58 / 0.15)",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to:   { transform: "translateX(0)",    opacity: "1" },
        },
        "slide-in-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to:   { transform: "translateY(0)",   opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "shimmer": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-up":    "slide-in-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
        "shimmer":        "shimmer 2s ease-in-out infinite",
        "spin-slow":      "spin-slow 3s linear infinite",
        "count-up":       "count-up 0.4s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
