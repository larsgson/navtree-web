/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--accent, #1a5276)",
          light: "var(--accent-hover, #2980b9)",
        },
      },
    },
  },
  plugins: [],
}
