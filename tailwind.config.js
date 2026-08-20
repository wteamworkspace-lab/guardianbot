/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        line: '#06C755',
        'line-dark': '#05a847',
        'line-light': '#e8f9ee'
      },
      fontFamily: {
        sans: ['Prompt', 'sans-serif']
      }
    },
  },
  plugins: [],
};
