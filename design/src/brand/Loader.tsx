import { useId } from 'react';
import { cx, toSvgId } from '../lib/cx';
import { BiteMask, BittenCircle, LogoGradient } from './brand-svg';
import './brand.css';

const CRUMBS_MIN_SIZE = 64;
const BASE_SIZE = 120; // крихти масштабуються від цього розміру

type LoaderProps = {
  size?: number;
  tone?: 'brand' | 'onPrimary';
  /** Текст для скрінрідера: t('common.loading'). */
  ariaLabel: string;
  /** Видимий підпис під лоадером (повний екран), уже перекладений. */
  label?: string;
  className?: string;
};

/**
 * Надкушений пряник обертається, з укусу падають крихти. Без літери k.
 * Це Spinner із CLAUDE.md: для коротких дій і повноекранного старту. Для відомої структури — Skeleton.
 *   <Loader size={20} tone="onPrimary" ariaLabel={t('common.loading')} />  — у кнопці
 */
export const Loader = ({ size = 32, tone = 'brand', ariaLabel, label, className }: LoaderProps) => {
  const reactId = useId();
  const gradientId = toSvgId('ldg', reactId);
  const maskId = toSvgId('ldm', reactId);
  const hasCrumbs = size >= CRUMBS_MIN_SIZE && tone === 'brand';
  const scale = size / BASE_SIZE;

  const mark = (
    <span role="img" aria-label={ariaLabel} className="k-loader" style={{ width: size, height: size }}>
      <svg className="k-loader-spin" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          {tone === 'brand' && <LogoGradient id={gradientId} />}
          <BiteMask id={maskId} />
        </defs>
        <BittenCircle fill={tone === 'brand' ? `url(#${gradientId})` : '#FFFFFF'} maskId={maskId} />
      </svg>
      {hasCrumbs && (
        <>
          <span
            className="k-loader-crumb"
            style={{ right: -2 * scale, top: 24 * scale, width: 8 * scale, height: 8 * scale }}
          />
          <span
            className="k-loader-crumb k-loader-crumb-2"
            style={{ right: 10 * scale, top: 12 * scale, width: 6 * scale, height: 6 * scale }}
          />
        </>
      )}
    </span>
  );

  if (!label) return <span className={className}>{mark}</span>;

  return (
    <div className={cx('k-loader-block', className)} aria-live="polite">
      {mark}
      <span className="k-loader-label">{label}</span>
    </div>
  );
};
