import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        foundry: {
          950: '#0a0a0b',
          900: '#0d0d0e',
          800: '#151517',
          750: '#1a1a1d',
          700: '#222226',
          600: '#2d2d33',
          500: '#3d3d47',
          400: '#55555f',
          300: '#7a7a87',
          200: '#a5a5b0',
          100: '#d4d4db',
          50: '#f0f0f2',
        },
        amber: {
          950: '#1f1200',
          900: '#2a1800',
          800: '#3d2300',
          700: '#553200',
          600: '#704500',
          500: '#9e5f00',
          400: '#d98200',
          300: '#ffaa1a',
          200: '#ffbb3d',
          100: '#ffdd77',
          50: '#fff4d6',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(217, 130, 0, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(217, 130, 0, 0.6)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config