/**
 * Kusik — звуки. Синтезуються Web Audio прямо в браузері: жодних файлів, ~0 КБ.
 * 1:1 з interactive/sounds.html — відкрий його, щоб послухати кожен звук.
 *
 *   import { play } from '@/design/src/sound/sounds';
 *   play('kusik');               // страву записано
 *
 * Правила (docs/sounds.md):
 *  - Звук завжди разом з візуальним відгуком, ніколи замість нього.
 *  - Перший звук лише після жесту користувача (політика автоплею), тому unlock() у першому onClick.
 *  - Налаштування «Звуки» і «Вібрація» живуть в «Налаштування → Звуки й вібрація» (mockups/settings.html); за замовчуванням звук УВІМКНЕНО, гучність 0.6.
 *  - Для перебору калорій і наближення до ліміту звуку НЕМАЄ — лише тиша.
 *  - Не більше одного звуку за 150 мс (throttle нижче), щоб пачка записів не «тріщала».
 */

export type SoundName =
  | 'kusik'     // Кусь — страву записано (найчастіший, найтихіший), 0.15 с
  | 'goal'      // Ціль дня — калорії в нормі / білок добрано, 0.6 с
  | 'achieve'   // Досягнення — серія днів, мінус кілограм, 1.3 с
  | 'saved'     // Збережено — рецепт, факт у пам'ять, 0.05 с
  | 'clarify'   // Уточнення — хом'як питає, 0.4 с
  | 'oops'      // Ой — помилка / немає зв'язку, 0.35 с
  | 'photoFail' // Фото не вийшло, 0.3 с
  | 'micStart'  // Мікрофон: старт, 0.06 с
  | 'micStop'   // Мікрофон: стоп, 0.06 с
  | 'remind';   // Нагадування (лише всередині застосунку; push використовує системний звук)

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

type Settings = { sound: boolean; haptics: boolean; volume: number };
const settings: Settings = { sound: true, haptics: true, volume: 0.6 };

export function configureSound(next: Partial<Settings>) {
  Object.assign(settings, next);
  if (master) master.gain.value = settings.volume;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings.volume;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Виклич у першому обробнику кліку/тапу, щоб розблокувати аудіо на iOS. */
export function unlock() {
  audio();
}

/* ───────────── примітиви ───────────── */

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Дерев'яний молоточок: синус + швидкий яскравий обертон. */
function mallet(freq: number, t: number, dur: number, vol: number) {
  const c = ctx!;
  ([[1, 1], [4, 0.25], [10, 0.06]] as const).forEach(([mult, amp], i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    env(g, t, vol * amp, 0.004, i === 0 ? dur : dur * 0.25);
    o.connect(g);
    g.connect(master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
}

/** Дзвіночок: негармонійні обертони, довший хвіст. */
function bell(freq: number, t: number, dur: number, vol: number) {
  const c = ctx!;
  ([[1, 1], [2.76, 0.35], [5.4, 0.12]] as const).forEach(([mult, amp], i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    env(g, t, vol * amp, 0.003, dur / (i + 1));
    o.connect(g);
    g.connect(master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
}

function soft(freq: number, t: number, dur: number, vol: number, type: OscillatorType = 'triangle', glideTo?: number) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  env(g, t, vol, 0.01, dur);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** «Кусь»: три короткі сплески смугового шуму, як укус печива. */
function crunch(t: number, vol: number, centre = 2600) {
  const c = ctx!;
  [0, 0.028, 0.05].forEach((dt, i) => {
    const s = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = centre * (1 - i * 0.15);
    f.Q.value = 1.6;
    env(g, t + dt, vol * (1 - i * 0.3), 0.002, 0.035);
    s.connect(f);
    f.connect(g);
    g.connect(master!);
    s.start(t + dt, Math.random() * 0.3, 0.06);
  });
}

function click(t: number, vol: number) {
  const c = ctx!;
  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noiseBuf;
  f.type = 'highpass';
  f.frequency.value = 3000;
  env(g, t, vol, 0.001, 0.012);
  s.connect(f);
  f.connect(g);
  g.connect(master!);
  s.start(t, 0, 0.03);
}

const C4 = 261.63, E4 = 329.63, A4 = 440, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, D6 = 1174.66;

const RECIPES: Record<SoundName, (t: number) => void> = {
  kusik: (t) => { crunch(t, 0.55); mallet(E5 * 1.5, t + 0.07, 0.12, 0.18); },
  goal: (t) => { mallet(C5, t, 0.35, 0.35); mallet(E5, t + 0.1, 0.35, 0.33); mallet(G5, t + 0.2, 0.5, 0.33); },
  achieve: (t) => {
    crunch(t, 0.4);
    [C5, E5, G5, C6].forEach((f, i) => mallet(f, t + 0.06 + i * 0.09, 0.5, 0.3));
    bell(C6 * 2, t + 0.45, 0.9, 0.08);
    bell(G5 * 2, t + 0.55, 0.8, 0.06);
  },
  saved: (t) => { click(t, 0.35); mallet(1400, t, 0.05, 0.12); },
  clarify: (t) => { bell(G5, t, 0.3, 0.22); bell(D6, t + 0.11, 0.4, 0.18); },
  oops: (t) => { soft(E4, t, 0.16, 0.3, 'triangle'); soft(C4, t + 0.14, 0.22, 0.3, 'triangle'); },
  photoFail: (t) => { soft(A4, t, 0.3, 0.22, 'sine', A4 * 0.82); },
  micStart: (t) => { soft(600, t, 0.06, 0.2, 'sine', 900); },
  micStop: (t) => { soft(900, t, 0.06, 0.2, 'sine', 600); },
  remind: (t) => { crunch(t, 0.5); bell(E5, t + 0.12, 0.3, 0.2); bell(C6, t + 0.24, 0.45, 0.16); },
};

let lastAt = 0;

/** Програти звук (і вібрацію, якщо дозволено). Безпечно викликати будь-де — помилки ковтаються. */
export function play(name: SoundName) {
  const now = performance.now();
  if (now - lastAt < 150) return;
  lastAt = now;

  if (settings.haptics && 'vibrate' in navigator) {
    try { navigator.vibrate(HAPTICS[name]); } catch { /* ignore */ }
  }
  if (!settings.sound || document.visibilityState !== 'visible') return;
  const c = audio();
  if (!c) return;
  try {
    RECIPES[name](c.currentTime + 0.02);
  } catch { /* ignore */ }
}
