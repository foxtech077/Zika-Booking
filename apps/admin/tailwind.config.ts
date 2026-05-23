import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#1a73e8", dark: "#1557b0" },
        zika: { navy: "#1B2D5B" },
      },
    },
  },
  plugins: [],
};
export default config;
