/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#060911',
          900: '#0c1322',
          800: '#172033',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
        }
      }
    },
  },
  plugins: [],
}
