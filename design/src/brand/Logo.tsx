import { useId } from 'react';
import { cx, toSvgId } from '../lib/cx';
import { BiteMask, BittenCircle, BRAND_NAME, LogoGradient, WORDMARK } from './brand-svg';
import './brand.css';

const MIN_SIZE_WITH_LETTER = 20;

type LogoMarkProps = {
  size?: number;
  /** Без літери k — для дуже дрібних розмірів. Під 20px літера ховається автоматично. */
  hasLetter?: boolean;
  /** Одноколірна версія: колір пряника. */
  monoColor?: string;
  /** false — знак декоративний (поруч є слово «kusik»). */
  isLabelled?: boolean;
  className?: string;
};

/** Знак: надкушений пряник з кремовою «k». Геометрія 1:1 з mockups/brand-logo.html. */
export const LogoMark = ({ size = 40, hasLetter = true, monoColor, isLabelled = true, className }: LogoMarkProps) => {
  const reactId = useId();
  const gradientId = toSvgId('lg', reactId);
  const maskId = toSvgId('lm', reactId);
  const shouldShowLetter = hasLetter && size >= MIN_SIZE_WITH_LETTER;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cx('shrink-0', className)}
      role={isLabelled ? 'img' : undefined}
      aria-label={isLabelled ? BRAND_NAME : undefined}
      aria-hidden={isLabelled ? undefined : true}
    >
      <defs>
        {!monoColor && <LogoGradient id={gradientId} />}
        <BiteMask id={maskId} />
      </defs>
      <BittenCircle fill={monoColor ?? `url(#${gradientId})`} maskId={maskId} />
      {shouldShowLetter && (
        <text
          x="47"
          y="66"
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontWeight={800}
          fontSize="46"
          fill={monoColor ? 'var(--color-primary)' : 'var(--color-logo-letter)'}
        >
          k
        </text>
      )}
    </svg>
  );
};

type LogoProps = { size?: number; className?: string };

/** Знак + слово «kusik» (завжди малими). Розмір слова = 0.7 × size, вага 800, трекінг −0.04em. */
export const Logo = ({ size = 32, className }: LogoProps) => (
  <span className={cx('inline-flex items-center', className)} style={{ gap: size * 0.28 }}>
    <LogoMark size={size} isLabelled={false} />
    <span
      className="k-wordmark"
      style={{ fontSize: Math.round(size * 0.7) }}
    >
      {WORDMARK}
    </span>
  </span>
);
