export type SoundName =
	/** Кусь — meal logged (most frequent, quietest), 0.15 s */
	| 'kusik'
	/** Ціль дня — calories within goal / protein reached, 0.6 s */
	| 'goal'
	/** Досягнення — streak, minus a kilogram, 1.3 s */
	| 'achieve'
	/** Збережено — recipe saved, fact remembered, 0.05 s */
	| 'saved'
	/** Уточнення — the hamster asks, 0.4 s */
	| 'clarify'
	/** Ой — error / offline, 0.35 s */
	| 'oops'
	/** Photo not recognised, 0.3 s */
	| 'photoFail'
	/** Voice recording started, 0.06 s */
	| 'micStart'
	/** Voice recording stopped, 0.06 s */
	| 'micStop'
	/** In-app reminder (push uses the system sound), 0.5 s */
	| 'remind'

/** The Web Audio nodes every synth primitive plays through. */
export interface AudioGraph {
	context: AudioContext
	master: GainNode
	noise: AudioBuffer
}
