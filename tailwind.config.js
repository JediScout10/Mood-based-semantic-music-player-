/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFCF7',
          100: '#FAF7F0',
          200: '#F5EFE3',
          300: '#ECE3D0',
        },
        coral: {
          light: '#FFA094',
          DEFAULT: '#FF6B6B',
          dark: '#E04F4F',
        },
        periwinkle: {
          light: '#A3B4FF',
          DEFAULT: '#6B7FF5',
          dark: '#4F5CD1',
        },
        lavender: {
          light: '#E8DEF8',
          DEFAULT: '#C4B5FD',
          dark: '#9B87F5',
        },
        mint: {
          light: '#D1FAE5',
          DEFAULT: '#6EE7B7',
          dark: '#34D399',
        },
        sunny: {
          light: '#FEF9C3',
          DEFAULT: '#FDE047',
          dark: '#FACC15',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '3px 3px 0px 0px rgba(24, 24, 27, 0.9)',
        'brutal-lg': '5px 5px 0px 0px rgba(24, 24, 27, 0.9)',
        'brutal-sm': '2px 2px 0px 0px rgba(24, 24, 27, 0.9)',
      }
    },
  },
  plugins: [],
}
