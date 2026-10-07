// Спільна геометрія знака (viewBox 0 0 100 100): надкушене коло r42 і маска з трьома укусами.
// Використовують LogoMark і Loader — не малюй знак інакше.

export const BRAND_NAME = 'Kusik';
export const WORDMARK = 'kusik';

export const BiteMask = ({ id }: { id: string }) => (
  <mask id={id}>
    <rect width="100" height="100" fill="#FFFFFF" />
    <circle cx="91" cy="31" r="10" fill="#000000" />
    <circle cx="83" cy="18" r="10" fill="#000000" />
    <circle cx="70" cy="10" r="9.5" fill="#000000" />
  </mask>
);

export const LogoGradient = ({ id }: { id: string }) => (
  <linearGradient id={id} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
    <stop offset="0" stopColor="var(--color-logo-from)" />
    <stop offset="1" stopColor="var(--color-logo-to)" />
  </linearGradient>
);

export const BittenCircle = ({ fill, maskId }: { fill: string; maskId: string }) => (
  <circle cx="50" cy="50" r="42" fill={fill} mask={`url(#${maskId})`} />
);
