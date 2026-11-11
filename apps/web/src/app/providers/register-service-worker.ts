import type { LiveWorkoutResponse } from '@kus/shared'
import { registerSW } from 'virtual:pwa-register'

import { LIVE_WORKOUT_QUERY_KEY } from '@/entities/workout'
import { useLiveWorkoutStore } from '@/features/live-workout'
import { useComposerDraftStore, useOutboxStore, usePhotoDraftStore } from '@/features/send-message'

import { queryClient } from './query-client'
import { shouldApplyUpdate, type UpdateTrigger } from './service-worker-update'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const LAST_APPLY_KEY = 'kus:sw-update-at'

const readLastApplyAt = (): number | null => {
	try {
		const value = Number(sessionStorage.getItem(LAST_APPLY_KEY))
		return Number.isFinite(value) && value > 0 ? value : null
	} catch {
		// storage blocked: without the mark the cooldown can't be kept — treat it as just applied
		return Date.now()
	}
}

const writeLastApplyAt = (now: number): void => {
	try {
		sessionStorage.setItem(LAST_APPLY_KEY, String(now))
	} catch {
		// nothing to keep; readLastApplyAt already refuses a second apply without storage
	}
}

const isSending = (): boolean =>
	Object.values(useOutboxStore.getState().items).some((item) => item.status === 'sending')

const hasDraft = (): boolean => {
	const photo = usePhotoDraftStore.getState()
	return (
		useComposerDraftStore.getState().text.trim().length > 0 ||
		photo.status === 'processing' ||
		photo.photo !== null
	)
}

const hasFocusedField = (): boolean =>
	document.activeElement?.matches('input, textarea, [contenteditable]') ?? false

/** An open session (the shared query) or sets still waiting for the server (persisted snapshots). */
const hasLiveWorkout = (): boolean =>
	Boolean(queryClient.getQueryData<LiveWorkoutResponse | null>(LIVE_WORKOUT_QUERY_KEY)) ||
	Object.keys(useLiveWorkoutStore.getState().snapshots).length > 0

/**
 * Registers the service worker and applies a waiting version silently, at a quiet moment (see
 * service-worker-update.ts). The version is checked hourly and whenever the tab comes back.
 */
export const setupServiceWorker = (): void => {
	if (!import.meta.env.PROD) return

	let isUpdatePending = false
	let applyUpdate: (() => Promise<void>) | null = null
	let activeRegistration: ServiceWorkerRegistration | null = null
	// a cold start counts as «just came back»: the user opened the app and has not touched it yet
	let lastVisibleAt: number | null = document.visibilityState === 'visible' ? Date.now() : null
	let hasInteractedSinceVisible = false

	// registered before the update listener below, so it sees the fresh values
	document.addEventListener('visibilitychange', () => {
		const isVisible = document.visibilityState === 'visible'
		lastVisibleAt = isVisible ? Date.now() : null
		if (isVisible) hasInteractedSinceVisible = false
	})
	// passive: these only observe; preventDefault on pointerdown breaks taps in WebKit
	const markInteraction = (): void => {
		hasInteractedSinceVisible = true
	}
	document.addEventListener('pointerdown', markInteraction, { capture: true, passive: true })
	document.addEventListener('keydown', markInteraction, { capture: true, passive: true })

	const tryApply = (trigger: UpdateTrigger): void => {
		// the flag is spent before an apply; a version that still waits (the apply was refused or did
		// not take) is picked up again when the tab comes back
		if (trigger === 'visibility-change' && activeRegistration?.waiting) isUpdatePending = true
		if (!isUpdatePending || !applyUpdate) return
		const now = Date.now()
		const isAllowed = shouldApplyUpdate({
			trigger,
			visibilityState: document.visibilityState,
			lastVisibleAt,
			hasInteractedSinceVisible,
			hasFocusedField: hasFocusedField(),
			isSending: isSending(),
			hasDraft: hasDraft(),
			hasLiveWorkout: hasLiveWorkout(),
			lastApplyAt: readLastApplyAt(),
			now,
		})
		if (!isAllowed) return
		// one apply per «need refresh»: the flag goes before the call, so no event can repeat it
		isUpdatePending = false
		writeLastApplyAt(now)
		void applyUpdate()
	}

	const updateSW = registerSW({
		immediate: true,
		onNeedRefresh: () => {
			isUpdatePending = true
			tryApply('need-refresh')
		},
		onRegisteredSW: (_url, registration) => {
			if (!registration) return
			activeRegistration = registration
			const checkForUpdate = (): void => {
				registration.update().catch(() => {
					// offline or the server is down: the next check tries again
				})
			}
			setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') checkForUpdate()
				tryApply('visibility-change')
			})
		},
	})
	applyUpdate = () => updateSW(true)
}
