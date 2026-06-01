import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "!./**/*-MPR.{js,ts,jsx,tsx,mdx}",
    "!./components/sections/TrustBand.tsx",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f2527",
        forest: "#15392f",
        teal: "#2c8c83",
        cream: "#f7f2e8",
        parchment: "#eee4d4",
        mist: "#dbe7df",
        brass: "#b89561",
      },
      fontFamily: {
        serif: ["Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Georgia", "serif"],
        sans: ["Aptos", "Inter", "Segoe UI", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 52px rgba(15, 37, 39, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
