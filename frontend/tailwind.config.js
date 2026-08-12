/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── Brand palette ──────────────────────────────────────
        brand: {
          50:  '#f5f7fa',
          100: '#e4ebf3',
          200: '#c5d3e5',
          300: '#9cb5d3',
          400: '#6d92be',
          500: '#4b73a4',
          600: '#3a5b88',
          700: '#2f496e',
          800: '#273c5b',
          900: '#23344d',
        },

        // ─── Semantic color tokens (from CSS vars) ──────────────
        primary:      'rgb(var(--color-primary) / <alpha-value>)',
        background:   'rgb(var(--color-background) / <alpha-value>)',
        surface:      'rgb(var(--color-surface) / <alpha-value>)',
        border:       'rgb(var(--color-border) / <alpha-value>)',
        'text-base':  'rgb(var(--color-text-base) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        danger:       'rgb(var(--color-danger) / <alpha-value>)',
        success:      'rgb(var(--color-success) / <alpha-value>)',
        warning:      'rgb(var(--color-warning) / <alpha-value>)',
        info:         'rgb(var(--color-info) / <alpha-value>)',

        // ─── Surface elevation system (from CSS vars) ───────────
        'surface-base':     'rgb(var(--surface-base) / <alpha-value>)',
        'surface-raised':   'rgb(var(--surface-raised) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'surface-overlay':  'rgb(var(--surface-overlay) / <alpha-value>)',
        'surface-hover':    'rgb(var(--surface-hover) / <alpha-value>)',
        'surface-active':   'rgb(var(--surface-active) / <alpha-value>)',
        'surface-sidebar':  'rgb(var(--surface-sidebar) / <alpha-value>)',
      },

      // ─── Typography ─────────────────────────────────────────────
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },

      // ─── Box shadows ─────────────────────────────────────────────
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'xs':  '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
      },

      // ─── Animation durations from CSS vars ──────────────────────
      transitionDuration: {
        'fast':   '150ms',
        'normal': '250ms',
        'slow':   '400ms',
      },
    },
  },
  plugins: [],
}
