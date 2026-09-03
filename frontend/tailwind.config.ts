import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        tactical: {
          dark: "#0a0f1d",
          card: "#111827",
          border: "#1f2937",
          muted: "#9ca3af",
          accent: "#38bdf8",
          critical: "#ef4444",
          high: "#f97316",
          medium: "#facc15",
          low: "#10b981",
        }
      },
      animation: {
        "pulse-radar": "pulseRadar 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "beacon": "beaconPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
      keyframes: {
        pulseRadar: {
          "0%": { transform: "scale(0.95)", opacity: "1" },
          "70%": { transform: "scale(2.2)", opacity: "0" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        beaconPing: {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
