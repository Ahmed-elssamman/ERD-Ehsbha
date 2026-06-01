import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import preset from '../../packages/ui-tokens/src/tailwind-preset.js';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [animate],
} satisfies Config;
