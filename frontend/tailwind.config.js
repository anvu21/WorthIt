/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#1c1917',
        paper: '#faf7f2',
        tier: { 1: '#16a34a', 2: '#d97706', 3: '#e11d48', side: '#7c3aed', special: '#0284c7' },
      },
    },
  },
  plugins: [],
}
