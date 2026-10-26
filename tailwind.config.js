/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Togetherly professional light palette: deep blue-green, slate text, quiet surfaces
        base: {
          bg: '#F6F8FA',       // Main application background
          sidebar: '#FFFFFF',  // Sidebar background
          card: '#FFFFFF',     // Main content surfaces
          hover: '#F1F5F7',    // Subtle hover state
          border: '#E2E8EC',   // Clean enterprise borders
          subtle: '#FAFBFC',   // Secondary surface
        },
        primary: {
          DEFAULT: '#315D70',  // Togetherly blue-green
          50: '#F1F6F8',
          100: '#E3EDF0',
          200: '#C8DCE2',
          300: '#A5C4CD',
          400: '#739FAB',
          500: '#315D70',
          600: '#284E5F',
          700: '#203F4D',
          800: '#18313D',
          900: '#11252D',
        },
        cyan: {
          DEFAULT: '#4D787D',  // Restrained secondary teal
          50: '#F2F7F6',
          100: '#E2EFED',
          200: '#C6DEDA',
          300: '#9DC9C2',
          400: '#78AFA8',
          500: '#4D787D',
          600: '#3C6569',
          700: '#2C5054',
        },
        text: {
          primary: '#1B2D3A',   // High-contrast dark charcoal
          secondary: '#627383', // Professional slate gray
          muted: '#8795A0',
        },
        success: '#2E6B55',     // Muted green
        warning: '#9C6426',     // Muted amber
        critical: '#B84A4A',    // Muted red
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(19, 39, 49, 0.035), 0 1px 1px rgba(19, 39, 49, 0.025)',
        'card-hover': '0 6px 16px rgba(19, 39, 49, 0.07), 0 1px 3px rgba(19, 39, 49, 0.035)',
        dropdown: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
        modal: '0 16px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'fade-in-up': 'fadeInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in-scale': 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
