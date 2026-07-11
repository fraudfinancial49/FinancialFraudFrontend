/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vault: {
          950: "#05070d",
          900: "#0a0e1a",
          850: "#0e1424",
          800: "#131a2e",
          700: "#1c2540",
          600: "#2a3660",
          500: "#3d4d85",
        },
        risk: {
          low: "#2fd97f",
          moderate: "#f5b942",
          high: "#f2545b",
          critical: "#c0203a",
        },
        accent: {
          teal: "#12b3a8",
          indigo: "#5b6df8",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};
