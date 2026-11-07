import { useEffect, useState } from 'react'

import { useDelayedFlag } from '@/shared/lib'

import type { LiveSyncStatus } from './create-live-sync'
import { type LiveNetPhase, SAVED_VISIBLE_MS } from './live-net-phase.types'

interface TrackerState {
	status: LiveSyncStatus
	/** The connection was lost and the unsent sets have not gone through yet. */
	wasOffline: boolean
	isSavedShown: boolean
}

const advance = (prev: TrackerState, status: LiveSyncStatus): TrackerState => {
	if (status === 'offline') return { status, wasOffline: true, isSavedShown: false }
	if (status === 'saving') return { status, wasOffline: prev.wasOffline, isSavedShown: false }
	if (status === 'idle') {
		return { status, wasOffline: false, isSavedShown: prev.wasOffline }
	}
	return { status, wasOffline: false, isSavedShown: false }
}

/**
 * What the pill under the header says. A normal online save stays silent: «Синхронізую…» and
 * «Збережено» only follow a spell without the network.
 */
export const useLiveNetPhase = (status: LiveSyncStatus): LiveNetPhase => {
	const [tracker, setTracker] = useState<TrackerState>({
		status,
		wasOffline: false,
		isSavedShown: false,
	})
	// derived while rendering: the status changed, so the tracker moves with it
	let current = tracker
	if (tracker.status !== status) {
		current = advance(tracker, status)
		setTracker(current)
	}

	const isSaved = current.isSavedShown
	useEffect(() => {
		if (!isSaved) return
		const timer = setTimeout(() => {
			setTracker((latest) => ({ ...latest, isSavedShown: false }))
		}, SAVED_VISIBLE_MS)
		return () => {
			clearTimeout(timer)
		}
	}, [isSaved])

	// a failed retry lasts a few ms: keep «Без мережі» instead of flashing «Синхронізую…»
	const isSyncingShown = useDelayedFlag(status === 'saving' && current.wasOffline)

	if (status === 'offline') return 'offline'
	if (status === 'saving' && current.wasOffline) return isSyncingShown ? 'syncing' : 'offline'
	if (status === 'idle' && current.isSavedShown) return 'saved'
	return 'hidden'
}
