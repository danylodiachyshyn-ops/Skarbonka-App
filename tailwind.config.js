/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        surface: '#F5F5F5',
        primary: {
          50: '#e6f5fc',
          100: '#b3e0f5',
          200: '#80cbed',
          300: '#4db6e6',
          400: '#33a8e8', // Light blue (top)
          500: '#1f96d3', // Deep blue (main)
          600: '#1a7db0',
          700: '#15648d',
          800: '#104b6a',
          900: '#0b3247',
        },
        brand: {
          lightBlue: '#33A8E8',
          deepBlue: '#1F96D3',
          white: '#FFFFFF',
          darkGray: '#4A4E52',
        },
      },
    },
  },
  plugins: [],
};
