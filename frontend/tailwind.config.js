import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  // Absolute globs so utility generation works regardless of the CWD Vite is
  // launched from (e.g. repo root vs. the frontend dir).
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{js,jsx,ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // Near-black / neutral scale — replaces the old amber/brown palette
        brand: {
          950: "#0A0A0A",   // near-black  — primary headings, strong text
          900: "#171717",   // black        — buttons, body text
          800: "#262626",   // dark gray    — hover states
          700: "#525252",   // mid gray     — secondary / caption text
          300: "#A3A3A3",   // light gray   — muted icons
          200: "#E5E5E5",   // border gray  — card borders, dividers
          100: "#F5F5F5",   // very light   — chip / tag backgrounds
          50:  "#FAFAFA",   // near-white   — subtle surface tints
        },
        // Single red accent — CTAs, active states, resemblance score highlights
        gold: "#D7263D",
      },
      fontFamily: {
        // Luxury serif display for headings; Helvetica stack for body text
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans:  ['"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0, transform: "translateY(6px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        spin:   { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        spin:      "spin 0.8s linear infinite",
      },
    },
  },
  plugins: [],
};
