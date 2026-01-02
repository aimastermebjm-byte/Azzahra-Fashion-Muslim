/** @type {import('tailwindcss').Config} */
const modernNavy = {
  50: '#F4F6FB',
  100: '#E4E8F5',
  200: '#C8D0EA',
  300: '#A0B2D8',
  400: '#5B6B9B',
  500: '#344066',
  600: '#0F172A',
  700: '#0B1220',
  800: '#080C16',
  900: '#05070D'
};

const modernGold = {
  50: '#FFF9F0',
  100: '#FDEFD8',
  200: '#F9DFAF',
  300: '#F5CE85',
  400: '#F0BC5C',
  500: '#D6A354',
  600: '#B8873D',
  700: '#8C642B',
  800: '#62441C',
  900: '#3B260F'
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'fade-in-scale': 'fadeInScale 0.6s ease-out',
        'slide-up': 'slideUp 0.8s ease-out 0.2s both',
        'fade-in': 'fadeIn 0.8s ease-out both',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeInScale: {
          '0%': { 
            opacity: '0',
            transform: 'scale(0.8)'
          },
          '100%': { 
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        slideUp: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(30px)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' }
        }
      },
      colors: {
        brand: {
          primary: '#0F172A',
          primaryDark: '#070B16',
          surface: '#F7F4EE',
          card: '#FFFFFF',
          border: '#E2DED5',
          accent: '#D6A354',
          accentMuted: '#F4E7D3',
          success: '#2D8A5D',
          warning: '#C35627',
          info: '#1C2A44'
        },
        purple: modernNavy,
        pink: modernGold,
        slate: {
          950: '#02040a'
        }
      },
      boxShadow: {
        'brand-card': '0 20px 45px rgba(15, 23, 42, 0.08)'
      },
      borderColor: {
        'brand-border': '#E2DED5'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0F172A 0%, #1C2A44 55%, #D6A354 100%)',
        'brand-surface': 'linear-gradient(180deg, #F7F4EE 0%, #FFFFFF 100%)'
      }
    }
  },
  plugins: [],
};
