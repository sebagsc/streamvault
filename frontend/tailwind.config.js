/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f13',
          secondary: '#16161c',
          elevated: '#1e1e28',
          card: '#1a1a23',
        },
        accent: {
          DEFAULT: '#00d4aa',
          hover: '#00b894',
          muted: 'rgba(0,212,170,0.15)',
        },
        surface: {
          DEFAULT: '#252530',
          hover: '#2e2e3e',
          border: '#2d2d3d',
        },
        text: {
          primary: '#f0f0f5',
          secondary: '#9898b0',
          muted: '#606078',
        },
        status: {
          live: '#ef4444',
          online: '#22c55e',
          broken: '#f97316',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-live': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
