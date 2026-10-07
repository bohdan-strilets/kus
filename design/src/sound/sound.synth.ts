import type { SynthContext } from './sound.types';

// Примітиви синтезу. 1:1 з interactive/sounds.html — там їх можна послухати.

const SILENCE = 0.0001;

const envelope = (gain: GainNode, t: number, peak: number, attack: number, decay: number): void => {
  gain.gain.setValueAtTime(SILENCE, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(SILENCE, t + attack + decay);
};

type Overtone = readonly [multiplier: number, amplitude: number];

const MALLET_PARTIALS: readonly Overtone[] = [[1, 1], [4, 0.25], [10, 0.06]];
const BELL_PARTIALS: readonly Overtone[] = [[1, 1], [2.76, 0.35], [5.4, 0.12]];

/** Дерев'яний молоточок: синус + швидкий яскравий обертон. */
export const mallet = ({ ctx, master }: SynthContext, freq: number, t: number, dur: number, vol: number): void => {
  MALLET_PARTIALS.forEach(([multiplier, amplitude], i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * multiplier;
    envelope(gain, t, vol * amplitude, 0.004, i === 0 ? dur : dur * 0.25);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
};

/** Дзвіночок: негармонійні обертони, довший хвіст. */
export const bell = ({ ctx, master }: SynthContext, freq: number, t: number, dur: number, vol: number): void => {
  BELL_PARTIALS.forEach(([multiplier, amplitude], i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * multiplier;
    envelope(gain, t, vol * amplitude, 0.003, dur / (i + 1));
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
};

type SoftOptions = { freq: number; t: number; dur: number; vol: number; type?: OscillatorType; glideTo?: number };

export const soft = ({ ctx, master }: SynthContext, { freq, t, dur, vol, type = 'triangle', glideTo }: SoftOptions): void => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  envelope(gain, t, vol, 0.01, dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
};

const CRUNCH_OFFSETS = [0, 0.028, 0.05];
const CRUNCH_CENTRE_HZ = 2600;

/** «Кусь»: три короткі сплески смугового шуму, як укус печива. */
export const crunch = ({ ctx, master, noise }: SynthContext, t: number, vol: number): void => {
  CRUNCH_OFFSETS.forEach((offset, i) => {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = CRUNCH_CENTRE_HZ * (1 - i * 0.15);
    filter.Q.value = 1.6;
    envelope(gain, t + offset, vol * (1 - i * 0.3), 0.002, 0.035);
    source.connect(filter).connect(gain).connect(master);
    source.start(t + offset, Math.random() * 0.3, 0.06);
  });
};

export const click = ({ ctx, master, noise }: SynthContext, t: number, vol: number): void => {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noise;
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  envelope(gain, t, vol, 0.001, 0.012);
  source.connect(filter).connect(gain).connect(master);
  source.start(t, 0, 0.03);
};
