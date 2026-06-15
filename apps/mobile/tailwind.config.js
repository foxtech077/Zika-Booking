/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aligned with K.colors.accent — vivid brand green
        primary: {
          DEFAULT: "#22C55E",
          dark: "#16A34A",
          light: "#4ADE80",
        },
        brand: {
          dark: "#0D3D2B",
          mid: "#0F3225",
          surface: "#163B28",
          accent: "#22C55E",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
