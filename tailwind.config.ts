import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0d14',
          50: '#1a1f2c',
          100: '#141823',
          200: '#0f131c',
          900: '#05070b',
        },
        bone: {
          DEFAULT: '#f4ede0',
          dim: '#bdb6a8',
          mute: '#7d7768',
        },
        phase: {
          base: '#4a8db8',
          build1: '#8db84a',
          build2: '#f0a830',
          peak: '#e83a17',
          taper: '#ffd24a',
        },
        sport: {
          swim: '#4a8db8',
          bike: '#f0a830',
          run: '#e83a17',
          strength: '#9d6bd6',
          brick: '#ffd24a',
          cross: '#7d7768',
          rest: '#3a4150',
        },
        signal: {
          green: '#5fbf6b',
          yellow: '#f0c93a',
          red: '#e83a17',
        },
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        body: ['"Archivo Narrow"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        display: '0.04em',
        wider2: '0.16em',
      },
    },
  },
  plugins: [],
} satisfies Config;
