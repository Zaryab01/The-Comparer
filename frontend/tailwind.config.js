/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6F0",
        brand: {
          950: "#2D1507",
          900: "#6B4423",
          800: "#7D5132",
          700: "#8F5E41",
          200: "#E8D5C0",
          100: "#F3E9DC",
          50:  "#FAF6F0",
        },
        gold: "#C9A84C",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
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
