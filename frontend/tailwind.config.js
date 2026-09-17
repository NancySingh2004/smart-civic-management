/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          navy: '#12213C',
          slate: '#2C4A78',
          slateLight: '#3E6096',
          gold: '#C79A3E',
          goldLight: '#E4C06E',
          bg: '#F5F6F9',
          card: '#FFFFFF',
          ink: '#1B2130',
          muted: '#616A7A',
          border: '#E2E5EC',
          success: '#2E7D5B',
          successBg: '#E7F3EC',
          warning: '#B8860B',
          warningBg: '#FBF1DC',
          danger: '#B03A2E',
          dangerBg: '#FBEAE8',
          info: '#2C4A78',
          infoBg: '#E9EEF6',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 33, 60, 0.06), 0 1px 8px rgba(18, 33, 60, 0.05)',
      },
    },
  },
  plugins: [],
}
