import type { Config } from 'tailwindcss'

// Colours come from CSS variables in src/styles/tokens.css (DESIGN_SYSTEM §2).
// Use logical utilities only (ms-, me-, ps-, pe-, start-, end-): the app must work in RTL.
const v = (name: string) => `var(--${name})`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: { DEFAULT: v('sage'), soft: v('sage-soft'), mid: v('sage-mid'), deep: v('sage-deep') },
        ink: { DEFAULT: v('ink'), deep: v('ink-deep'), soft: v('ink-soft') },
        cream: v('cream'),
        paper: { DEFAULT: v('paper'), deep: v('paper-deep') },
        wood: v('wood'),
        blush: v('blush'),
        muted: v('muted'),
        line: v('line'),
      },
      fontFamily: { sans: ['"Readex Pro"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      fontSize: {
        tab: ['11px', '14px'],
        meta: ['13px', '18px'],
        card: ['15px', '20px'],
        body: ['16px', '22px'],
        code: ['18px', '24px'],
        sheet: ['21px', '26px'],
        'title-sm': ['22px', '28px'],
        title: ['27px', '32px'],
      },
      borderRadius: { card: '22px', group: '20px', sheet: '26px', btn: '16px' },
    },
  },
  plugins: [],
} satisfies Config
