/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Основная палитра - земляные тона для "полевой" тематики
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        earth: {
          50: '#faf8f5',
          100: '#f2ede5',
          200: '#e4d9c9',
          300: '#d3c0a5',
          400: '#c0a17e',
          500: '#b18a62',
          600: '#a47654',
          700: '#896046',
          800: '#704f3d',
          900: '#5c4234',
          950: '#31221a',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

