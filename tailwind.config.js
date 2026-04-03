/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gh-dark': '#0d1117',
        'gh-darker': '#161b22',
        'gh-border': '#30363d',
        'gh-text': '#e6edf3',
        'gh-text-secondary': '#7d8590',
      },
    },
  },
  plugins: [],
}