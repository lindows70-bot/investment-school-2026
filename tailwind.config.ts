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
          secondary: '#C0CEDB',   // brightened for darkest bg (#020617): 12.5:1
          muted:     '#9BABB8',   // brightened: 8.1:1
          faint:     '#8A9DB0',   // brightened: 7.1:1
        },
        // Tailwind zinc 기본값 오버라이드 — 기본값이 어두운 배경에서 너무 어두움
        zinc: {
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D1D5DB',   // was #D4D4D8 → neutral bright
          400: '#B0B8C4',   // was #A1A1AA(7.9:1) → 10.1:1
          500: '#9FA8B3',   // was #71717A(4.2:1) → 8.4:1
          600: '#8E9AAA',   // was #52525B(2.6:1) → 7.1:1
          700: '#6B7B8D',   // was #3F3F46 → readable
          800: '#3D4F63',   // was #27272A → brightened
          900: '#1A2030',
          950: '#0F1520',
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
