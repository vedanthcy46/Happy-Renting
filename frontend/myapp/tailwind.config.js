/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50 : '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#0f172a',
          card   : '#1e293b',
          hover  : '#334155',
          border : '#334155',
        },
        success: { light: '#d1fae5', DEFAULT: '#10b981', dark: '#065f46' },
        warning: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#92400e' },
        danger : { light: '#fee2e2', DEFAULT: '#ef4444', dark: '#991b1b' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0,0,0,0.3)',
        card : '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)',
        glow : '0 0 20px rgba(59,130,246,0.3)',
      },
      animation: {
        'fade-in'     : 'fadeIn 0.3s ease-out',
        'slide-up'    : 'slideUp 0.3s ease-out',
        'pulse-glow'  : 'pulseGlow 2s infinite',
      },
      keyframes: {
        fadeIn   : { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp  : { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(59,130,246,0)' } },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};

