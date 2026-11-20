/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#040810',
          900: '#080e1a',
          850: '#0c1626',
          800: '#111f36',
          700: '#1a2e4f',
          600: '#233d69',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          300: '#67e8f9',
        },
        marine: {
          deep: '#0a192f',
          accent: '#00e5ff',
          surface: '#1e293b',
          glow: '#00f0ff33',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
