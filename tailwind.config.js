/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Togetherly Azure-inspired enterprise palette: clear blue actions, calm surfaces, readable data
        base: {
          bg: '#F5F7FA',       // Main application background
          sidebar: '#FFFFFF',  // Sidebar background
          card: '#FFFFFF',     // Main content surfaces
          hover: '#F1F5F9',    // Subtle hover state
          border: '#E1E5EA',   // Clean enterprise borders
          subtle: '#F8FAFC',   // Secondary surface
        },
        primary: {
          DEFAULT: '#0078D4',  // Togetherly blue-green
          50: '#EFF6FC',
          100: '#DDEEFF',
          200: '#C7E0F4',
          300: '#9CCFF3',
          400: '#5CB0F2',
          500: '#0078D4',
          600: '#106EBE',
          700: '#005A9E',
          800: '#004578',
          900: '#00345B',
        },
        cyan: {
          DEFAULT: '#0F6CBD',  // Restrained secondary teal
          50: '#EFF6FC',
          100: '#DDEEFF',
          200: '#C7E0F4',
          300: '#9CCFF3',
          400: '#5CB0F2',
          500: '#0F6CBD',
          600: '#106EBE',
          700: '#005A9E',
        },
        text: {
          primary: '#242424',   // High-contrast dark charcoal
          secondary: '#616161', // Professional slate gray
          muted: '#7A7A7A',
        },
        success: '#107C10',     // Muted green
        warning: '#8A5A00',     // Muted amber
        critical: '#A4262C',    // Muted red
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
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
        xl: '9px',
        '2xl': '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.035), 0 1px 1px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 6px 16px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.025)',
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
