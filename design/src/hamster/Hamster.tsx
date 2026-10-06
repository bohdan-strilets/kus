import { useId, useRef } from 'react';
import { cx, toSvgId } from '../lib/cx';
import { useBlink } from '../motion/use-blink';
import { Body, Cookie, CookieDefs, PawDown, PawWave } from './hamster-parts';
import { HAMSTER_MOODS } from './hamster.moods';
import type { HamsterProps } from './hamster.types';
import './hamster.css';

/**
 * Хом'як Kusik — повне тіло з пряником у лапках.
 *   <Hamster mood="happy" size={140} label={t(HAMSTER_LABEL_KEYS.happy)} />
 * Без label — декоративний (коли поруч є текст, що все пояснює).
 */
export const Hamster = ({ mood = 'wave', size = 120, label, blink = true, className }: HamsterProps) => {
  const reactId = useId();
  const gradientId = toSvgId('kg', reactId);
  const maskId = toSvgId('kb', reactId);
  const ref = useRef<SVGSVGElement>(null);
  useBlink(ref, { enabled: blink });

  const parts = HAMSTER_MOODS[mood];
  const isDecorative = !label;

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={cx('k-hamster', className)}
      data-mood={mood}
      role={isDecorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={isDecorative || undefined}
    >
      <CookieDefs gradientId={gradientId} maskId={maskId} />
      {parts.back}
      <Body />
      {parts.over}
      <Cookie gradientId={gradientId} maskId={maskId} />
      {parts.paw === 'wave' ? <PawWave /> : <PawDown />}
      {parts.face}
      {parts.front}
    </svg>
  );
};
