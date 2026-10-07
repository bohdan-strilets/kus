import type { HamsterMood } from './hamster.types';

// Хом'як — ілюстрація, тому має власні кольори, а не UI-токени. Не змінюються з темою.
export const HAMSTER_COLORS = {
  fur: '#F6B98A',
  furDark: '#E89A68',
  cheek: '#F9C7A0',
  belly: '#FFEBD8',
  earInner: '#F7B3A2',
  blush: '#F28E7A',
  nose: '#D96B5C',
  eye: '#2B1D14',
  brow: '#C97F52',
  whisker: '#D7A27C',
  accent: '#E58A45',
  accentLight: '#F2A877',
  bubble: '#F2B987',
  bell: '#F5C451',
  sweat: '#8FCBF2',
  moon: '#F8D9A8',
  success: '#17845A',
  white: '#FFFFFF',
  toothLine: '#E2CDBD',
  logoFrom: '#FFB877',
  logoTo: '#D45F22',
  logoLetter: '#FFF4E6',
} as const;

// i18n-ключі підписів для скрінрідера. Тексти — у src/i18n/uk.json.
export const HAMSTER_LABEL_KEYS: Record<HamsterMood, string> = {
  wave: 'hamster.mood.wave',
  happy: 'hamster.mood.happy',
  think: 'hamster.mood.think',
  logged: 'hamster.mood.logged',
  support: 'hamster.mood.support',
  surprised: 'hamster.mood.surprised',
  yum: 'hamster.mood.yum',
  hungry: 'hamster.mood.hungry',
  proud: 'hamster.mood.proud',
  remind: 'hamster.mood.remind',
  oops: 'hamster.mood.oops',
  sleepy: 'hamster.mood.sleepy',
};

export const BLINK_FIRST_DELAY_MS = 1500;
export const BLINK_MIN_INTERVAL_MS = 4000;
export const BLINK_JITTER_MS = 2000;
