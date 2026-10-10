import { RECIPES } from './recipes'
import { HAPTICS, MASTER_VOLUME, MIN_SOUND_INTERVAL_MS, SCHEDULE_LEAD_S } from './sound.constants'
import type { AudioGraph, SoundName } from './sound.types'
import { useSoundSettingsStore } from './sound-settings-store'

/**
 * Kusik sounds, synthesised with Web Audio: no files, works offline (design/docs/sounds.md).
 * Always paired with a visual cue, never instead of one. Over-goal calories have no sound.
 */

const NOISE_SECONDS = 0.5

let graph: AudioGraph | null = null
let lastPlayedAt = Number.NEGATIVE_INFINITY

const getAudioContextClass = (): typeof AudioContext | undefined => {
	if ('AudioContext' in window) return window.AudioContext
	// Safari < 14.1 exposes only the prefixed constructor
	return (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

const createGraph = (): AudioGraph | null => {
	const AudioContextClass = getAudioContextClass()
	if (!AudioContextClass) return null
	const context = new AudioContextClass()
	const master = context.createGain()
	master.gain.value = MASTER_VOLUME
	master.connect(context.destination)
	const noise = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate)
	const channel = noise.getChannelData(0)
	for (let index = 0; index < channel.length; index++) channel[index] = Math.random() * 2 - 1
	return { context, master, noise }
}

const getGraph = (): AudioGraph | null => {
	graph ??= createGraph()
	if (graph?.context.state === 'suspended') void graph.context.resume()
	return graph
}

/** Call in the first click/tap handler: browsers (iOS especially) block audio until a gesture. */
export const unlockSound = (): void => {
	getGraph()
}

const vibrate = (name: SoundName): void => {
	if (!useSoundSettingsStore.getState().isHapticsOn || !('vibrate' in navigator)) return
	// without a user gesture the browser blocks vibration and logs an error
	// (`userActivation` is missing before Safari 16.4 — then just try)
	if ('userActivation' in navigator && !navigator.userActivation.hasBeenActive) return
	navigator.vibrate(HAPTICS[name])
}

/** Plays a sound (and vibration, if enabled). Throttled to one per 150 ms. */
export const playSound = (name: SoundName): void => {
	const now = performance.now()
	if (now - lastPlayedAt < MIN_SOUND_INTERVAL_MS) return
	lastPlayedAt = now

	vibrate(name)
	if (!useSoundSettingsStore.getState().isSoundOn || document.visibilityState !== 'visible') return
	const audio = getGraph()
	if (!audio) return
	RECIPES[name](audio, audio.context.currentTime + SCHEDULE_LEAD_S)
}
