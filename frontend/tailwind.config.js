/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#080808',
          light: '#0f0f0f',
          dark: '#040404',
        },
        accent: {
          red: '#e63946',
          'red-dark': '#c1121f',
          'red-deep': '#780000',
          crimson: '#dc2626',
          maroon: '#3d0000',
          blue: '#3b82f6',
          'blue-dark': '#2563eb',
          purple: '#8b5cf6',
          'purple-dark': '#7c3aed',
          gold: '#f59e0b',
        },
        surface: {
          DEFAULT: '#121212',
          light: '#1a1a1a',
          dark: '#0a0a0a',
          card: '#161616',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'glow-red': 'glow-red 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'slide-left': 'slide-left 30s linear infinite',
        'slide-right': 'slide-right 30s linear infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'marquee': 'marquee var(--marquee-duration, 30s) linear infinite',
        'marquee-reverse': 'marquee-reverse var(--marquee-duration, 30s) linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 20px rgba(230, 57, 70, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(230, 57, 70, 0.6), 0 0 80px rgba(220, 38, 38, 0.3)' },
        },
        'glow-red': {
          '0%': { boxShadow: '0 0 15px rgba(230, 57, 70, 0.2), inset 0 0 15px rgba(230, 57, 70, 0.05)' },
          '100%': { boxShadow: '0 0 30px rgba(230, 57, 70, 0.4), inset 0 0 30px rgba(230, 57, 70, 0.1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'slide-left': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sparkle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.2)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(to bottom, rgba(8,8,8,0.8), rgba(8,8,8,1))',
      },
    },
  },
  plugins: [],
};
