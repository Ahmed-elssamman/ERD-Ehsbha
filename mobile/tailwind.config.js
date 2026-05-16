/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F14',
        surface: '#131922',
        surface2: '#1B2330',
        text: '#E8ECF1',
        textMuted: '#8B95A7',
        accent: '#34D399',
        accentAlt: '#60A5FA',
        warn: '#F59E0B',
        danger: '#F87171',
        border: '#232C3B',
      },
      fontFamily: {
        sans: ['Cairo_400Regular', 'system-ui'],
        medium: ['Cairo_600SemiBold'],
        bold: ['Cairo_700Bold'],
      },
    },
  },
  plugins: [],
};
