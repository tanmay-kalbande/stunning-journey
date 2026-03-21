// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Work Sans', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      },
      colors: {
        // Frans Hals Museum inspired palette
        'museum-dark': '#001317',
        'museum-dark-light': '#002024',
        'museum-dark-lighter': '#003035',
        'museum-gold': '#FECD8C',
        'museum-gold-dim': '#E5B87E',
        'museum-gold-bright': '#FFD9A0',
        'museum-border': 'rgba(254, 205, 140, 0.3)',
        'museum-border-strong': 'rgba(254, 205, 140, 0.6)',
        'museum-text': '#FFFFFF',
        'museum-text-dim': 'rgba(255, 255, 255, 0.7)',
        'museum-text-muted': 'rgba(255, 255, 255, 0.5)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // Extend typography styles
      typography: (theme) => ({
        DEFAULT: {
          css: {
            // --- Unstyle default code blocks to prevent "box-in-box" ---
            pre: {
              backgroundColor: null,
              padding: null,
              margin: null,
              borderRadius: null,
              border: null,
            },
            'pre code': {
              backgroundColor: 'transparent',
              borderWidth: '0',
              borderRadius: '0',
              padding: '0',
              fontWeight: '400',
              color: 'inherit',
              fontFamily: 'inherit',
            },
            // --- Define a consistent style for inline code ---
            ':not(pre) > code': {
              backgroundColor: 'var(--color-border)',
              padding: '0.2em 0.4em',
              margin: '0 0.1em',
              fontSize: '0.9em',
              borderRadius: '0.25rem',
              color: 'var(--color-text-secondary)',
              fontWeight: '500',
            },
            // --- Reset pseudo-elements that prose adds ---
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
};
