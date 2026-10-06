import type { AudioGraph } from './sound.types'

/** Synth primitives, 1:1 with design/src/sound/sounds.ts. All times are AudioContext seconds. */

const SILENCE = 0.0001

const applyEnvelope = (
	gain: GainNode,
	time: number,
	peak: number,
	attack: number,
	decay: number,
): void => {
	gain.gain.setValueAtTime(SILENCE, time)
	gain.gain.exponentialRampToValueAtTime(peak, time + attack)
	gain.gain.exponentialRampToValueAtTime(SILENCE, time + attack + decay)
}

interface ToneOptions {
	frequency: number
	time: number
	duration: number
	volume: number
}

const playPartials = (
	graph: AudioGraph,
	{ frequency, time, duration, volume }: ToneOptions,
	partials: readonly (readonly [number, number])[],
	getDecay: (index: number) => number,
	attack: number,
): void => {
	partials.forEach(([multiplier, amplitude], index) => {
		const oscillator = graph.context.createOscillator()
		const gain = graph.context.createGain()
		oscillator.type = 'sine'
		oscillator.frequency.value = frequency * multiplier
		applyEnvelope(gain, time, volume * amplitude, attack, getDecay(index))
		oscillator.connect(gain)
		gain.connect(graph.master)
		oscillator.start(time)
		oscillator.stop(time + duration + 0.05)
	})
}

const MALLET_PARTIALS = [
	[1, 1],
	[4, 0.25],
	[10, 0.06],
] as const

/** Wooden mallet: sine plus a quick bright overtone. */
export const playMallet = (graph: AudioGraph, tone: ToneOptions): void => {
	playPartials(
		graph,
		tone,
		MALLET_PARTIALS,
		(index) => (index === 0 ? tone.duration : tone.duration * 0.25),
		0.004,
	)
}

const BELL_PARTIALS = [
	[1, 1],
	[2.76, 0.35],
	[5.4, 0.12],
] as const

/** Bell: inharmonic overtones, longer tail. */
export const playBell = (graph: AudioGraph, tone: ToneOptions): void => {
	playPartials(graph, tone, BELL_PARTIALS, (index) => tone.duration / (index + 1), 0.003)
}

interface SoftToneOptions extends ToneOptions {
	type?: OscillatorType
	glideTo?: number
}

export const playSoft = (
	graph: AudioGraph,
	{ frequency, time, duration, volume, type = 'triangle', glideTo }: SoftToneOptions,
): void => {
	const oscillator = graph.context.createOscillator()
	const gain = graph.context.createGain()
	oscillator.type = type
	oscillator.frequency.setValueAtTime(frequency, time)
	if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, time + duration)
	applyEnvelope(gain, time, volume, 0.01, duration)
	oscillator.connect(gain)
	gain.connect(graph.master)
	oscillator.start(time)
	oscillator.stop(time + duration + 0.05)
}

const CRUNCH_OFFSETS_S = [0, 0.028, 0.05] as const
const CRUNCH_CENTRE_HZ = 2600

/** «Кусь»: three short band-passed noise bursts, like biting a cookie. */
export const playCrunch = (graph: AudioGraph, time: number, volume: number): void => {
	CRUNCH_OFFSETS_S.forEach((offset, index) => {
		const source = graph.context.createBufferSource()
		const filter = graph.context.createBiquadFilter()
		const gain = graph.context.createGain()
		source.buffer = graph.noise
		filter.type = 'bandpass'
		filter.frequency.value = CRUNCH_CENTRE_HZ * (1 - index * 0.15)
		filter.Q.value = 1.6
		applyEnvelope(gain, time + offset, volume * (1 - index * 0.3), 0.002, 0.035)
		source.connect(filter)
		filter.connect(gain)
		gain.connect(graph.master)
		source.start(time + offset, Math.random() * 0.3, 0.06)
	})
}

export const playClick = (graph: AudioGraph, time: number, volume: number): void => {
	const source = graph.context.createBufferSource()
	const filter = graph.context.createBiquadFilter()
	const gain = graph.context.createGain()
	source.buffer = graph.noise
	filter.type = 'highpass'
	filter.frequency.value = 3000
	applyEnvelope(gain, time, volume, 0.001, 0.012)
	source.connect(filter)
	filter.connect(gain)
	gain.connect(graph.master)
	source.start(time, 0, 0.03)
}
