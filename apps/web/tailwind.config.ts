import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        primary: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          DEFAULT: "#16a34a",
          dark:    "#15803d",
          light:   "#4ade80",
        },
        accent: {
          DEFAULT: "#7c3aed",
          light:   "#ede9fe",
        },
        zika: {
          navy:        "#1B2D5B",
          "navy-light":"#243a73",
          gold:        "#F4A41A",
          teal:        "#0E9F9F",
          orange:      "#FF6B35",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle:  "#f4faf7",
          muted:   "#f1f5f9",
          dark:    "#0f172a",
        },
        border: {
          DEFAULT: "#e8f0ec",
          strong:  "#cbd5e1",
        },
        success: {
          DEFAULT: "#10b981",
          light:   "#d1fae5",
          dark:    "#065f46",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light:   "#fef3c7",
          dark:    "#92400e",
        },
        danger: {
          DEFAULT: "#ef4444",
          light:   "#fee2e2",
          dark:    "#7f1d1d",
        },
        info: {
          DEFAULT: "#3b82f6",
          light:   "#dbeafe",
          dark:    "#1e3a8a",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card:           "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
        "card-md":      "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
        "card-lg":      "0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)",
        drawer:         "rgba(0, 0, 0, 0.15) -4px 0 20px",
        "glow-primary": "0 0 0 3px rgb(22 163 74 / 0.2)",
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
        shimmer: {
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
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.7" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-up":    "slide-in-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
        shimmer:          "shimmer 2s ease-in-out infinite",
        "spin-slow":      "spin-slow 3s linear infinite",
        "count-up":       "count-up 0.4s ease-out",
        "pulse-soft":     "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
