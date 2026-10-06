/**
 * Kusik — логотип: надкушений пряник (коло з трьома «зубчиками» вгорі праворуч)
 * з кремовою літерою k всередині, плюс wordmark «kusik» малими літерами.
 *
 *   <LogoMark size={40} />               — тільки знак (шапка чату, splash)
 *   <Logo size={32} />                   — знак + слово (лендинг, авторизація)
 *   <LogoMark size={20} mono="#fff" />   — одноколірний (на кнопці primary)
 *
 * Геометрія 1:1 з mockups/brand-logo.html. Не малюй знак інакше,
 * не змінюй кут і кількість зубчиків, не прибирай укус.
 */
import { useId } from 'react';

function useSvgId(prefix: string) {
  return prefix + useId().replace(/:/g, '');
}

/** Маска укусу у viewBox 0 0 100 100 — та сама, що в Loader. */
export function BiteMask({ id }: { id: string }) {
  return (
    <mask id={id}>
      <rect width="100" height="100" fill="#FFFFFF" />
      <circle cx="91" cy="31" r="10" fill="#000000" />
      <circle cx="83" cy="18" r="10" fill="#000000" />
      <circle cx="70" cy="10" r="9.5" fill="#000000" />
    </mask>
  );
}

export function LogoGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
      <stop offset="0" stopColor="var(--k-logo-from, #FFB877)" />
      <stop offset="1" stopColor="var(--k-logo-to, #D45F22)" />
    </linearGradient>
  );
}

export type LogoMarkProps = {
  size?: number;
  /** Без літери k — для лоадера та дрібних розмірів (< 20px). */
  letter?: boolean;
  /** Одноколірна версія: колір заливки пряника. Літера тоді вирізається прозорою. */
  mono?: string;
  title?: string;
  className?: string;
};

export function LogoMark({ size = 40, letter = true, mono, title = 'Kusik', className }: LogoMarkProps) {
  const g = useSvgId('lg');
  const m = useSvgId('lm');
  const showLetter = letter && size >= 20;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title} className={className}>
      <defs>
        {!mono && <LogoGradient id={g} />}
        <BiteMask id={m} />
      </defs>
      <circle cx="50" cy="50" r="42" fill={mono ?? `url(#${g})`} mask={`url(#${m})`} />
      {showLetter && (
        <text
          x="47"
          y="66"
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontWeight={800}
          fontSize="46"
          fill={mono ? 'var(--k-primary, #B9521A)' : 'var(--k-logo-letter, #FFF4E6)'}
        >
          k
        </text>
      )}
    </svg>
  );
}

export type LogoProps = { size?: number; className?: string };

/** Знак + слово. Розмір слова = 0.7 × size, вага 800, трекінг −0.04em, колір ink. */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}>
      <LogoMark size={size} title="" />
      <span
        style={{
          fontFamily: 'var(--k-font)',
          fontWeight: 800,
          fontSize: Math.round(size * 0.7),
          letterSpacing: '-0.04em',
          color: 'var(--k-ink, #2A2118)',
          lineHeight: 1,
        }}
      >
        kusik
      </span>
    </span>
  );
}

export default Logo;
