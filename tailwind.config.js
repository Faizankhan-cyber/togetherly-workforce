/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Microsoft Azure / 365 Light Enterprise Palette
        base: {
          bg: '#F5F7FA',       // Main application background
          sidebar: '#FFFFFF',  // Sidebar background
          card: '#FFFFFF',     // Main content surfaces
          hover: '#F0F6FC',    // Subtle hover state
          border: '#E1E6ED',   // Clean enterprise borders
          subtle: '#FAFBFD',   // Secondary surface
        },
        primary: {
          DEFAULT: '#0078D4',  // Microsoft Azure blue
          50: '#EFF6FC',
          100: '#DEECF9',
          200: '#C7E0F4',
          300: '#94C3EA',
          400: '#4CA0E0',
          500: '#0078D4',
          600: '#106EBE',
          700: '#005A9E',
          800: '#004578',
          900: '#003358',
        },
        cyan: {
          DEFAULT: '#0078D4',  // Mapped to Azure Blue for cohesive enterprise styling
          50: '#EFF6FC',
          100: '#DEECF9',
          200: '#C7E0F4',
          300: '#94C3EA',
          400: '#4CA0E0',
          500: '#0078D4',
          600: '#106EBE',
          700: '#005A9E',
        },
        text: {
          primary: '#172B4D',   // High-contrast dark charcoal
          secondary: '#5E6C84', // Professional slate gray
          muted: '#8993A4',
        },
        success: '#107C10',     // Microsoft Office Green
        warning: '#CA5010',     // Microsoft Amber/Orange
        critical: '#D13438',    // Microsoft Alert Red
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
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
