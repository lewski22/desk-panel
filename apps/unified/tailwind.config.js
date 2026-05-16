/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#B53578',
          hover:   '#9C2264',
        },
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
      },
      minHeight: { touch: '2.75rem' },
      minWidth:  { touch: '2.75rem' },
    },
  },
  plugins: [],
};
