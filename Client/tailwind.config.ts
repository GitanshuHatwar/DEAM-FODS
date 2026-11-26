import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sage: {
          primary: "#2E5D4B",
          muted: "#3F7A64",
        },
        mint: {
          light: "#E8F3EF",
        },
        warm: {
          bg: "#F8F6F3",
          beige: "#F4ECE1",
        },
        charcoal: "#0F172A",
        slate: {
          muted: "#6B7280",
        },
        soft: {
          border: "#E5E7EB",
        },
        status: {
          success: "#16A36A",
          warning: "#D99A45",
          error: "#DC6464",
          info: "#648DAA",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)",
        glass: "0 8px 30px rgba(15, 23, 42, 0.06)",
        drawer: "-8px 0 32px rgba(15, 23, 42, 0.09)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
