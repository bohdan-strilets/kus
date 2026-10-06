import { NOTE } from './sound.constants'
import type { AudioGraph, SoundName } from './sound.types'
import { playBell, playClick, playCrunch, playMallet, playSoft } from './synth'

type SoundRecipe = (graph: AudioGraph, time: number) => void

/** How each sound is synthesised, 1:1 with design/interactive/sounds.html. */
export const RECIPES: Record<SoundName, SoundRecipe> = {
	kusik: (graph, time) => {
		playCrunch(graph, time, 0.55)
		playMallet(graph, { frequency: NOTE.E5 * 1.5, time: time + 0.07, duration: 0.12, volume: 0.18 })
	},
	goal: (graph, time) => {
		playMallet(graph, { frequency: NOTE.C5, time, duration: 0.35, volume: 0.35 })
		playMallet(graph, { frequency: NOTE.E5, time: time + 0.1, duration: 0.35, volume: 0.33 })
		playMallet(graph, { frequency: NOTE.G5, time: time + 0.2, duration: 0.5, volume: 0.33 })
	},
	achieve: (graph, time) => {
		playCrunch(graph, time, 0.4)
		;[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((frequency, index) => {
			playMallet(graph, { frequency, time: time + 0.06 + index * 0.09, duration: 0.5, volume: 0.3 })
		})
		playBell(graph, { frequency: NOTE.C6 * 2, time: time + 0.45, duration: 0.9, volume: 0.08 })
		playBell(graph, { frequency: NOTE.G5 * 2, time: time + 0.55, duration: 0.8, volume: 0.06 })
	},
	saved: (graph, time) => {
		playClick(graph, time, 0.35)
		playMallet(graph, { frequency: 1400, time, duration: 0.05, volume: 0.12 })
	},
	clarify: (graph, time) => {
		playBell(graph, { frequency: NOTE.G5, time, duration: 0.3, volume: 0.22 })
		playBell(graph, { frequency: NOTE.D6, time: time + 0.11, duration: 0.4, volume: 0.18 })
	},
	oops: (graph, time) => {
		playSoft(graph, { frequency: NOTE.E4, time, duration: 0.16, volume: 0.3 })
		playSoft(graph, { frequency: NOTE.C4, time: time + 0.14, duration: 0.22, volume: 0.3 })
	},
	photoFail: (graph, time) => {
		playSoft(graph, {
			frequency: NOTE.A4,
			time,
			duration: 0.3,
			volume: 0.22,
			type: 'sine',
			glideTo: NOTE.A4 * 0.82,
		})
	},
	micStart: (graph, time) => {
		playSoft(graph, {
			frequency: 600,
			time,
			duration: 0.06,
			volume: 0.2,
			type: 'sine',
			glideTo: 900,
		})
	},
	micStop: (graph, time) => {
		playSoft(graph, {
			frequency: 900,
			time,
			duration: 0.06,
			volume: 0.2,
			type: 'sine',
			glideTo: 600,
		})
	},
	remind: (graph, time) => {
		playCrunch(graph, time, 0.5)
		playBell(graph, { frequency: NOTE.E5, time: time + 0.12, duration: 0.3, volume: 0.2 })
		playBell(graph, { frequency: NOTE.C6, time: time + 0.24, duration: 0.45, volume: 0.16 })
	},
}
