import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette
        brand: {
          DEFAULT: '#f97316', // orange-500 — warm, restaurant feel
          light:   '#fed7aa', // orange-200
          dark:    '#c2410c', // orange-700
        },
      },
    },
  },
} satisfies Config
