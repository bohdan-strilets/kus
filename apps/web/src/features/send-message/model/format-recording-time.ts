const SECONDS_PER_MINUTE = 60

/** «0:07» — the voice recording timer (mockups/chat-voice.html). */
export const formatRecordingTime = (totalSeconds: number): string => {
	const safeSeconds = Math.max(0, Math.floor(totalSeconds))
	const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE)
	const seconds = safeSeconds % SECONDS_PER_MINUTE
	return `${minutes}:${String(seconds).padStart(2, '0')}`
}
