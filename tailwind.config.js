/** @type {import('tailwindcss').Config} */

// Elegant Rose Gold Palette
const roseGold = {
  50: '#FDF8F5',
  100: '#FAF0EA',
  200: '#F5DFD3',
  300: '#EBCAB8',
  400: '#D4A574',
  500: '#C4956A',
  600: '#A87B52',
  700: '#8B6344',
  800: '#6E4D36',
  900: '#513829'
};

// Deep Burgundy/Rose for text & accents
const deepRose = {
  50: '#FCF5F7',
  100: '#F8E8EC',
  200: '#F0D0D9',
  300: '#E4A9B8',
  400: '#D17B92',
  500: '#8B4B6B',
  600: '#743F5A',
  700: '#5D3248',
  800: '#472537',
  900: '#301926'
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'display': ['Playfair Display', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'price': ['DM Sans', 'Inter', 'sans-serif']
      },
      animation: {
        'fade-in-scale': 'fadeInScale 0.6s ease-out',
        'slide-up': 'slideUp 0.8s ease-out 0.2s both',
        'fade-in': 'fadeIn 0.8s ease-out both',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
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
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      },
      colors: {
        brand: {
          // Primary - Dark Navy/Black
          primary: '#0F172A',
          primaryDark: '#070B16',
          primaryLight: '#1E293B',

          // Surface & Background - Soft Cream
          surface: '#FDF8F5',
          surfaceAlt: '#FAF0EA',
          card: '#FFFFFF',

          // Border
          border: '#E8E0D8',
          borderDark: '#D4C8BC',

          // Accent - Vibrant Gold
          accent: '#D4AF37',
          accentDark: '#B8962E',
          accentLight: '#F0D77A',
          accentMuted: '#F5EDD8',

          // Semantic
          success: '#4A8B6B',
          successLight: '#E8F5EE',
          warning: '#D4874A',
          warningLight: '#FFF5EB',
          error: '#C45454',
          errorLight: '#FDEDED',
          info: '#5A7B8B'
        },
        rose: deepRose,
        gold: roseGold,
        slate: {
          950: '#1a1a1a'
        }
      },
      boxShadow: {
        'brand-card': '0 4px 20px rgba(139, 75, 107, 0.08)',
        'brand-card-hover': '0 12px 40px rgba(139, 75, 107, 0.15)',
        'brand-button': '0 4px 14px rgba(212, 165, 116, 0.35)',
        'elegant': '0 2px 15px rgba(0, 0, 0, 0.05)',
        'elegant-lg': '0 8px 30px rgba(0, 0, 0, 0.08)'
      },
      borderColor: {
        'brand-border': '#F5DFD3'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #C9A96E 100%)',
        'brand-gradient-dark': 'linear-gradient(135deg, #070B16 0%, #0F172A 100%)',
        'brand-gradient-gold': 'linear-gradient(135deg, #C9A96E 0%, #A8894F 100%)',
        'brand-surface': 'linear-gradient(180deg, #FDF8F5 0%, #FFFFFF 100%)',
        'hero-pattern': 'radial-gradient(circle at 30% 20%, rgba(201, 169, 110, 0.1) 0%, transparent 50%)'
      }
    }
  },
  plugins: [],
};

