import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design system — "Obsidian" dark palette
        surface: {
          0:  '#080B11',   // page bg
          1:  '#0D1117',   // card bg
          2:  '#161B22',   // elevated card
          3:  '#1F2733',   // hover / input
          4:  '#2D3748',   // border default
          5:  '#3D4F63',   // border emphasis
        },
        brand: {
          DEFAULT: '#3B82F6',
          light:   '#60A5FA',
          dark:    '#1D4ED8',
          muted:   '#1E3A5F',
        },
        up:   { DEFAULT: '#10B981', light: '#34D399', muted: '#064E3B' },
        down: { DEFAULT: '#EF4444', light: '#F87171', muted: '#450A0A' },
        warn: { DEFAULT: '#F59E0B', light: '#FCD34D', muted: '#451A03' },
        ink: {
          primary:   '#F1F5F9',
          secondary: '#94A3B8',
          muted:     '#64748B',
          faint:     '#334155',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 20px 60px rgba(0,0,0,0.6)',
        glow: '0 0 20px rgba(59,130,246,0.15)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)',
        'gradient-up':    'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
        'gradient-down':  'linear-gradient(135deg, #450A0A 0%, #7F1D1D 100%)',
        'grid-pattern':   `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 40L40 0M-5 5L5-5M35 45L45 35' stroke='%23161B22' stroke-width='1'/%3E%3C/svg%3E")`,
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
}
export default config
