/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1a73e8", dark: "#1557b0", light: "#4d90fe" },
        zika: { orange: "#FF6B35", navy: "#1B2D5B" },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
