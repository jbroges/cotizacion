/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#667085",
        panel: "#f8fafc",
        brand: {
          50: "#eef4ff",
          600: "#315bea",
          700: "#2548c7",
        },
      },
      boxShadow: {
        panel: "0 1px 3px rgb(15 23 42 / 0.08), 0 1px 2px rgb(15 23 42 / 0.04)",
      },
    },
  },
  plugins: [],
};
