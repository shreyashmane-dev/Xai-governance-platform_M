export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#1E3A8A',
          700: '#1E40AF',
          900: '#172554',
        },
        success: {
          100: '#D1FAE5',
          500: '#10B981',
          700: '#047857',
        },
      }
    }
  },
  plugins: []
}
