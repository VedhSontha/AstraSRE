import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        accent:  "#6366f1",
        accent2: "#8b5cf6",
        cyan:    "#22d3ee",
        green:   "#10b981",
        red:     "#ef4444",
        yellow:  "#f59e0b",
        orange:  "#f97316",
      },
      animation: {
        "pulse-slow":    "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "float":         "float 6s ease-in-out infinite",
        "glow":          "glow 2s ease-in-out infinite alternate",
        "slide-up":      "slideUp 0.6s ease-out forwards",
        "fade-in":       "fadeIn 0.8s ease-out forwards",
        "spin-slow":     "spin 8s linear infinite",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-12px)" },
        },
        glow: {
          from: { boxShadow: "0 0 20px rgba(99,102,241,0.3)" },
          to:   { boxShadow: "0 0 40px rgba(99,102,241,0.8), 0 0 80px rgba(139,92,246,0.4)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
      backgroundImage: {
        "gradient-radial":   "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "hero-gradient":     "linear-gradient(135deg, #0a0a0f 0%, #0d0517 50%, #050a14 100%)",
        "card-gradient":     "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))",
        "glow-gradient":     "radial-gradient(circle at center, rgba(99,102,241,0.15), transparent 70%)",
      },
    },
  },
  plugins: [],
};

export default config;
