import { HAPTICS, SOUND_RECIPES } from './sound.recipes';
import type { SoundName, SoundSettings, SynthContext } from './sound.types';

// Звуки Kusik синтезуються Web Audio — без файлів, працюють офлайн. Правила: docs/sounds.md.
//   playSound('kusik')  — страву записано
// Звук завжди разом з візуальним відгуком, ніколи замість нього. Для перебору калорій звуку немає.

const THROTTLE_MS = 150;
const START_OFFSET_S = 0.02;
const NOISE_SECONDS = 0.5;

const settings: SoundSettings = { isSoundOn: true, isHapticsOn: true, volume: 0.6 };
let synth: SynthContext | null = null;
let lastPlayedAt = 0;

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

const createSynth = (): SynthContext | null => {
  const AudioContextClass = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AudioContextClass) return null;

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  return { ctx, master, noise };
};

const getSynth = (): SynthContext | null => {
  synth ??= createSynth();
  if (synth?.ctx.state === 'suspended') void synth.ctx.resume();
  return synth;
};

/** Налаштування «Звуки й вібрація» (екран Налаштування). */
export const configureSound = (next: Partial<SoundSettings>): void => {
  Object.assign(settings, next);
  if (synth) synth.master.gain.value = settings.volume;
};

/** Виклич у першому обробнику тапу — браузер не дає грати звук до жесту користувача (iOS). */
export const unlockSound = (): void => {
  getSynth();
};

const vibrate = (name: SoundName): void => {
  if (!settings.isHapticsOn || !('vibrate' in navigator)) return;
  // Без жесту користувача браузер блокує вібрацію з помилкою в консолі
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate(HAPTICS[name]);
};

/** Програти звук і вібрацію. Не частіше одного разу за 150 мс, мовчить у фоновій вкладці. */
export const playSound = (name: SoundName): void => {
  const now = performance.now();
  if (now - lastPlayedAt < THROTTLE_MS) return;
  lastPlayedAt = now;

  vibrate(name);
  if (!settings.isSoundOn || document.visibilityState !== 'visible') return;

  const current = getSynth();
  if (!current) return;
  SOUND_RECIPES[name](current, current.ctx.currentTime + START_OFFSET_S);
};
