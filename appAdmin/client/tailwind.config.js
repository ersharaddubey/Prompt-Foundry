/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          500: '#2a2a32',
          600: '#1f1f28',
          700: '#1a1a1f',
          800: '#14141a',
          900: '#0f0f12',
        },
      },
    },
  },
  plugins: [],
};
