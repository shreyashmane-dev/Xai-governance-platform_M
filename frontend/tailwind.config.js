export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        violet:  { DEFAULT: '#7c5cfc', light: '#a78bfa', dim: 'rgba(124,92,252,0.16)' },
        cyan:    { DEFAULT: '#22d3ee', dim: 'rgba(34,211,238,0.15)' },
        emerald: { DEFAULT: '#10b981', dim: 'rgba(16,185,129,0.15)' },
        rose:    { DEFAULT: '#f43f5e', dim: 'rgba(244,63,94,0.15)' },
        amber:   { DEFAULT: '#f59e0b', dim: 'rgba(245,158,11,0.15)' },
        surface: {
          base:    '#050811',
          DEFAULT: '#0c1120',
          elevated:'#111827',
          muted:   '#161f31',
        },
        // legacy compat
        primary: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          600: '#7c5cfc',
          700: '#6d4df0',
          900: '#3b1fa8',
        },
        success: {
          100: '#D1FAE5',
          500: '#10B981',
          700: '#047857',
        },
      },
      borderRadius: {
        'sm': '8px',
        DEFAULT: '14px',
        'lg': '20px',
        'xl': '28px',
      },
      boxShadow: {
        card: '0 4px 30px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        glow: '0 0 28px rgba(124,92,252,0.35)',
        'glow-cyan': '0 0 28px rgba(34,211,238,0.3)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'float': 'float-card 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
