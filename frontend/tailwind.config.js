/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Allow Tailwind classes to coexist with MUI without conflicts
  corePlugins: {
    preflight: false, // Disable Tailwind's base reset so MUI styles work properly
  },
}
