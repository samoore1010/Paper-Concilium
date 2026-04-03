/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        surface: {
          base: "rgb(var(--surface-base) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--surface-overlay) / <alpha-value>)",
        },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "nod": { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-3px)" } },
        "shake": { "0%, 100%": { transform: "rotate(0deg)" }, "25%": { transform: "rotate(-5deg)" }, "75%": { transform: "rotate(5deg)" } },
        "think": { "0%, 100%": { transform: "translateX(0)" }, "50%": { transform: "translateX(3px)" } },
        "blink": { "0%, 90%, 100%": { scaleY: "1" }, "95%": { scaleY: "0.1" } },
      },
      animation: {
        "nod": "nod 1s ease-in-out",
        "shake": "shake 0.5s ease-in-out",
        "think": "think 2s ease-in-out infinite",
        "blink": "blink 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
