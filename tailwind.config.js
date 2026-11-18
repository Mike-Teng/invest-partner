/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f3f1',
          100: '#e3e9e5',
          200: '#c7d1cc',
          300: '#a0b0a8',
          400: '#72877c',
          500: '#3e5149',
          600: '#303e38',
          700: '#25322b',
          800: '#202a25',
          900: '#18221c',
        },
        slate: {
          50: '#f7f8f6', 100: '#ecefed', 200: '#dce0df',
          300: '#a5aeaa', 400: '#6e7773', 500: '#626c66',
          600: '#4e5852', 700: '#3b443e', 800: '#252b27', 900: '#191f1b',
        },
        green: { 600: '#347a5e', 700: '#246548' },
        emerald: { 700: '#246f57' },
        surface: {
          DEFAULT: '#f3f4f3',
          50: '#fafbf9',
          100: '#ecefed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -6px rgba(0,0,0,0.04)',
        'glow': '0 0 20px rgba(37,40,44,0.10)',
        'glow-sm': '0 0 10px rgba(37,40,44,0.08)',
        'nav': '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

