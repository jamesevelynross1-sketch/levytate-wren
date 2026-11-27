import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "!./components/sections/TrustBand.tsx",
  ],
  theme: {
    extend: {
      colors: {
        lt: {
          ink: "rgb(var(--lt-ink, 16 44 61) / <alpha-value>)",
          secondary: "rgb(var(--lt-secondary, 64 82 96) / <alpha-value>)",
          muted: "rgb(var(--lt-muted, 82 101 117) / <alpha-value>)",
          accent: "rgb(var(--lt-accent, 8 118 109) / <alpha-value>)",
          risk: "rgb(var(--lt-risk, 173 52 78) / <alpha-value>)",
          canvas: "rgb(var(--lt-canvas, 246 247 245) / <alpha-value>)",
          surface: "rgb(var(--lt-surface, 255 255 255) / <alpha-value>)",
          soft: "rgb(var(--lt-soft, 241 245 242) / <alpha-value>)",
          border: "rgb(var(--lt-border, 221 227 224) / <alpha-value>)",
        },
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
