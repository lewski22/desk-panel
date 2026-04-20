/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      minHeight: { touch: '2.75rem' },
      minWidth:  { touch: '2.75rem' },
    },
  },
  plugins: [],
};
