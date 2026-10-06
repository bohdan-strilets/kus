/** Kusik Tailwind preset.
 *  tailwind.config.js:  presets: [require('./design/tokens/tailwind.preset.js')]
 *  Кольори беруться з CSS-змінних у tokens.css, тож їх достатньо змінити в одному місці.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--k-primary)', deep: 'var(--k-primary-deep)', soft: 'var(--k-primary-soft)', selected: 'var(--k-primary-selected)' },
        ink: 'var(--k-ink)',
        muted: { DEFAULT: 'var(--k-muted)', strong: 'var(--k-muted-strong)' },
        surface: { DEFAULT: 'var(--k-surface)', glass: 'var(--k-surface-glass)' },
        field: 'var(--k-field)',
        secondary: 'var(--k-button-secondary)',
        line: 'var(--k-line)',
        divider: 'var(--k-divider)',
        success: { DEFAULT: 'var(--k-success)', soft: 'var(--k-success-soft)', ink: 'var(--k-success-ink)' },
        danger: { DEFAULT: 'var(--k-danger)', soft: 'var(--k-danger-soft)' },
        over: 'var(--k-over)',
        scrim: 'var(--k-scrim)',
        protein: { bg: 'var(--k-protein-bg)', ink: 'var(--k-protein-ink)', bar: 'var(--k-protein-bar)' },
        carbs: { bg: 'var(--k-carbs-bg)', ink: 'var(--k-carbs-ink)', bar: 'var(--k-carbs-bar)' },
        fat: { bg: 'var(--k-fat-bg)', ink: 'var(--k-fat-ink)', bar: 'var(--k-fat-bar)' },
      },
      backgroundImage: {
        app: 'var(--k-bg-app)',
        'soft-card': 'var(--k-bg-soft-card)',
        'dark-card': 'var(--k-bg-dark-card)',
      },
      fontFamily: { sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      fontSize: {
        'screen-title': ['24px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'big-number': ['30px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '800' }],
        body: ['15px', { lineHeight: '1.45' }],
        'card-title': ['14px', { lineHeight: '1.3', fontWeight: '700' }],
        caption: ['13px', { lineHeight: '1.4', fontWeight: '600' }],
        small: ['12px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      borderRadius: {
        screen: 'var(--k-radius-screen)', sheet: 'var(--k-radius-sheet)', card: 'var(--k-radius-card)',
        bubble: 'var(--k-radius-bubble)', tail: 'var(--k-radius-tail)', tile: 'var(--k-radius-tile)',
        chip: 'var(--k-radius-chip)', icon: 'var(--k-radius-icon)', button: 'var(--k-radius-button)',
      },
      boxShadow: {
        card: 'var(--k-shadow-card)', chip: 'var(--k-shadow-chip)',
        accent: 'var(--k-shadow-accent)', sheet: 'var(--k-shadow-sheet)',
      },
      spacing: { gutter: '16px', touch: '44px', button: '48px' },
      transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },
      transitionTimingFunction: {
        out: 'cubic-bezier(.2, .8, .2, 1)',
        spring: 'cubic-bezier(.34, 1.56, .64, 1)',
        in: 'cubic-bezier(.4, 0, 1, 1)',
      },
    },
  },
};
