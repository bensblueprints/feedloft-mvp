const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [path.join(__dirname, 'index.html'), path.join(__dirname, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b0d10',
          raised: '#12151a',
          border: '#20252c',
        },
      },
    },
  },
  plugins: [],
};
