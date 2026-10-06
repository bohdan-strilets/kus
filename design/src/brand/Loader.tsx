/**
 * Kusik — лоадер: надкушений пряник обертається, з укусу падають крихти.
 * Без літери k (рішення з дизайну). Див. mockups/brand-loader.html.
 *
 *   <Loader size={120} label="Завантажую твій день…" />   — повний екран
 *   <Loader size={28} />                                   — у картці / списку
 *   <Loader size={20} tone="onPrimary" />                  — у кнопці primary (білий)
 *
 * Правила:
 *  - Показуй лише якщо чекання > 300 мс (інакше миготить). Хук useDelayedFlag нижче.
 *  - Кнопка під час завантаження не змінює розмір, текст каже що відбувається
 *    («Зберігаю…»), повторне натискання заблоковане (aria-busy + disabled).
 *  - Крихти лише від 64px і більше.
 */
import { useEffect, useId, useState } from 'react';
import { BiteMask, LogoGradient } from './Logo';
import './loader.css';

export type LoaderProps = {
  size?: number;
  tone?: 'brand' | 'onPrimary';
  /** Видимий підпис під лоадером (повний екран). */
  label?: string;
  className?: string;
};

export function Loader({ size = 32, tone = 'brand', label, className }: LoaderProps) {
  const raw = useId().replace(/:/g, '');
  const g = 'ldg' + raw;
  const m = 'ldm' + raw;
  const crumbs = size >= 64 && tone === 'brand';
  const k = size / 120; // крихти масштабуються від розміру 120

  const mark = (
    <span role="img" aria-label="Завантаження" className="k-loader" style={{ width: size, height: size }}>
      <svg className="k-loader-spin" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          {tone === 'brand' && <LogoGradient id={g} />}
          <BiteMask id={m} />
        </defs>
        <circle cx="50" cy="50" r="42" fill={tone === 'brand' ? `url(#${g})` : '#FFFFFF'} mask={`url(#${m})`} />
      </svg>
      {crumbs && (
        <>
          <span className="k-loader-crumb" style={{ right: -2 * k, top: 24 * k, width: 8 * k, height: 8 * k, background: '#E58A45' }} />
          <span className="k-loader-crumb k-loader-crumb-2" style={{ right: 10 * k, top: 12 * k, width: 6 * k, height: 6 * k, background: '#F7C59A' }} />
        </>
      )}
    </span>
  );

  if (!label) return <span className={className}>{mark}</span>;
  return (
    <div className={['k-loader-block', className].filter(Boolean).join(' ')} aria-live="polite">
      {mark}
      <span className="k-loader-label">{label}</span>
    </div>
  );
}

/** true лише якщо `active` тримається довше `delay` мс — щоб лоадер не миготів. */
export function useDelayedFlag(active: boolean, delay = 300) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);
  return show;
}

export default Loader;
