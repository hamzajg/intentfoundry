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
          950: '#0c1220',
          900: '#121b2e',
          800: '#1a2640',
          750: '#1f2d45',
          700: 'rgba(100, 180, 255, 0.12)',
          600: 'rgba(100, 180, 255, 0.20)',
          500: 'rgba(0, 212, 255, 0.25)',
          400: '#7a8a9a',
          300: '#a8b8c8',
          200: '#c0d0e0',
          100: '#f0f4f8',
          50: '#ffffff',
        },
        amber: {
          950: 'rgba(0, 212, 255, 0.10)',
          900: 'rgba(0, 212, 255, 0.12)',
          800: 'rgba(0, 212, 255, 0.20)',
          700: 'rgba(0, 212, 255, 0.25)',
          600: '#00d4ff',
          500: '#00d4ff',
          400: '#00d4ff',
          300: '#33ddff',
          200: '#66eeff',
          100: '#99f5ff',
          50: '#ccfaff',
        },
        success: '#10b981',
        warning: '#ff7a4d',
        danger: '#f04d4d',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Inter', '-apple-system', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 212, 255, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config