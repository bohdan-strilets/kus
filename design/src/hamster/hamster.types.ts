export type HamsterMood =
  | 'wave' // Привіт — перший запуск, ранок
  | 'happy' // Радіє — ціль дня закрита
  | 'think' // Думає — уточнює порцію, Kusik друкує
  | 'logged' // Записав — страву додано (із зеленою галочкою)
  | 'support' // Підтримує — перебір без докорів
  | 'surprised' // Здивований — «Ого, 900 ккал у салаті?»
  | 'yum' // Ласує — улюблений рецепт
  | 'hungry' // Голодний — нагадування про їжу
  | 'proud' // Гордий — серія днів, мінус кілограм
  | 'remind' // Нагадує — сповіщення
  | 'oops' // Ой — помилка, немає зв'язку
  | 'sleepy'; // Вечір — підсумок дня

export type HamsterHeadMood = 'smile' | 'smileOpen' | 'happy' | 'think' | 'proud' | 'content' | 'oops' | 'hungry';

export type HamsterProps = {
  mood?: HamsterMood;
  size?: number;
  /** Текст для скрінрідера через t(HAMSTER_LABEL_KEYS[mood]). Без нього хом'як декоративний (aria-hidden). */
  label?: string;
  /** Кліпати очима раз на 4–6 с. Вимикається при reduced motion. */
  blink?: boolean;
  className?: string;
};

export type HamsterHeadProps = {
  mood?: HamsterHeadMood;
  size?: number;
  className?: string;
};
