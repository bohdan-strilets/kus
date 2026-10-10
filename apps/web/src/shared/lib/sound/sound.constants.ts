import type { SoundName } from './sound.types'

/** Master gain of every sound. */
export const MASTER_VOLUME = 0.6

/** A burst of entries must not crackle: at most one sound per 150 ms. */
export const MIN_SOUND_INTERVAL_MS = 150

/** Small lead so the first note isn't clipped while the context schedules it. */
export const SCHEDULE_LEAD_S = 0.02

/** navigator.vibrate patterns. iOS Safari has no vibration — that's fine. */
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
}

/** Note frequencies, Hz. */
export const NOTE = {
	C4: 261.63,
	E4: 329.63,
	A4: 440,
	C5: 523.25,
	E5: 659.25,
	G5: 783.99,
	C6: 1046.5,
	D6: 1174.66,
} as const
