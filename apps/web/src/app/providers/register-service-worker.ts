import { registerSW } from 'virtual:pwa-register'

import { useComposerDraftStore, useOutboxStore, usePhotoDraftStore } from '@/features/send-message'

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

/**
 * Registers the service worker and applies a waiting version silently, at a quiet moment (see
 * service-worker-update.ts). The version is checked hourly and whenever the tab comes back.
 */
export const setupServiceWorker = (): void => {
	if (!import.meta.env.PROD) return

	let isUpdatePending = false
	let applyUpdate: (() => Promise<void>) | null = null

	const tryApply = (trigger: UpdateTrigger): void => {
		if (!isUpdatePending || !applyUpdate) return
		const now = Date.now()
		const isAllowed = shouldApplyUpdate({
			trigger,
			visibilityState: document.visibilityState,
			isSending: isSending(),
			hasDraft: hasDraft(),
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
