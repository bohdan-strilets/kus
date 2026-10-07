export type SoundName =
  | 'kusik' // Кусь — страву записано (найчастіший, найтихіший), 0.15 с
  | 'goal' // Ціль дня — калорії в нормі / білок добрано, 0.6 с
  | 'achieve' // Досягнення — серія днів, мінус кілограм, 1.3 с
  | 'saved' // Збережено — рецепт, факт у пам'ять, 0.05 с
  | 'clarify' // Уточнення — хом'як питає, 0.4 с
  | 'oops' // Ой — помилка / немає зв'язку, 0.35 с
  | 'photoFail' // Фото не вийшло, 0.3 с
  | 'micStart' // Мікрофон: старт, 0.06 с
  | 'micStop' // Мікрофон: стоп, 0.06 с
  | 'remind'; // Нагадування всередині застосунку (push грає системний звук)

export type SoundSettings = { isSoundOn: boolean; isHapticsOn: boolean; volume: number };

export type SynthContext = { ctx: AudioContext; master: GainNode; noise: AudioBuffer };
