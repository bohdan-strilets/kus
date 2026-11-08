import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface UseReorderAnnouncementOptions<T> {
	items: readonly T[]
	getName: (item: T) => string
	/** Applies the move; called only for a step that stays inside the list. */
	onMove: (index: number, delta: -1 | 1) => void
}

interface UseReorderAnnouncement {
	/** False, without calling `onMove`, when the step would leave the list. */
	move: (index: number, delta: -1 | 1) => boolean
	/** What a screen reader hears after a keyboard move; a drag by a finger needs no words. */
	announcement: string
}

export const useReorderAnnouncement = <T>({
	items,
	getName,
	onMove,
}: UseReorderAnnouncementOptions<T>): UseReorderAnnouncement => {
	const { t } = useTranslation()
	const [announcement, setAnnouncement] = useState('')

	const move = (index: number, delta: -1 | 1): boolean => {
		const item = items[index]
		const position = index + delta
		if (item === undefined || position < 0 || position >= items.length) return false
		onMove(index, delta)
		setAnnouncement(
			t('program.editor.position', {
				name: getName(item),
				position: position + 1,
				total: items.length,
			}),
		)
		return true
	}

	return { move, announcement }
}
