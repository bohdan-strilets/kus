import { bell, click, crunch, mallet, soft } from './sound.synth';
import type { SoundName, SynthContext } from './sound.types';

const NOTE = {
  C4: 261.63,
  E4: 329.63,
  A4: 440,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
  D6: 1174.66,
} as const;

/** Патерни вібрації (navigator.vibrate). iOS Safari вібрацію не підтримує — це нормально. */
export const HAPTICS: Record<SoundName, number[]> = {
  kusik: [12],
  goal: [15, 60, 15],
  achieve: [20, 50, 20, 50, 40],
  saved: [8],
  clarify: [10, 40, 10],
  oops: [30, 40, 30],
  photoFail: [25],
  micStart: [10],
  micStop: [10],
  remind: [15, 70, 15],
};

type Recipe = (s: SynthContext, t: number) => void;

export const SOUND_RECIPES: Record<SoundName, Recipe> = {
  kusik: (s, t) => {
    crunch(s, t, 0.55);
    mallet(s, NOTE.E5 * 1.5, t + 0.07, 0.12, 0.18);
  },
  goal: (s, t) => {
    mallet(s, NOTE.C5, t, 0.35, 0.35);
    mallet(s, NOTE.E5, t + 0.1, 0.35, 0.33);
    mallet(s, NOTE.G5, t + 0.2, 0.5, 0.33);
  },
  achieve: (s, t) => {
    crunch(s, t, 0.4);
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((freq, i) => mallet(s, freq, t + 0.06 + i * 0.09, 0.5, 0.3));
    bell(s, NOTE.C6 * 2, t + 0.45, 0.9, 0.08);
    bell(s, NOTE.G5 * 2, t + 0.55, 0.8, 0.06);
  },
  saved: (s, t) => {
    click(s, t, 0.35);
    mallet(s, 1400, t, 0.05, 0.12);
  },
  clarify: (s, t) => {
    bell(s, NOTE.G5, t, 0.3, 0.22);
    bell(s, NOTE.D6, t + 0.11, 0.4, 0.18);
  },
  oops: (s, t) => {
    soft(s, { freq: NOTE.E4, t, dur: 0.16, vol: 0.3 });
    soft(s, { freq: NOTE.C4, t: t + 0.14, dur: 0.22, vol: 0.3 });
  },
  photoFail: (s, t) => soft(s, { freq: NOTE.A4, t, dur: 0.3, vol: 0.22, type: 'sine', glideTo: NOTE.A4 * 0.82 }),
  micStart: (s, t) => soft(s, { freq: 600, t, dur: 0.06, vol: 0.2, type: 'sine', glideTo: 900 }),
  micStop: (s, t) => soft(s, { freq: 900, t, dur: 0.06, vol: 0.2, type: 'sine', glideTo: 600 }),
  remind: (s, t) => {
    crunch(s, t, 0.5);
    bell(s, NOTE.E5, t + 0.12, 0.3, 0.2);
    bell(s, NOTE.C6, t + 0.24, 0.45, 0.16);
  },
};
