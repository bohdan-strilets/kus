import { MESSAGE_TEXT_MAX_LENGTH } from '@kus/shared'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface ComposerDraftState {
	/** Whose text it is: another user (or none after logout) never sees it. */
	ownerId: string | null
	text: string
	/** The signed-in user (null after logout); a different one drops the previous one's text. */
	claim: (userId: string | null) => void
	setText: (text: string) => void
	clear: () => void
}

export const COMPOSER_DRAFT_STORAGE_KEY = 'kusik-composer-draft'
const COMPOSER_DRAFT_STORAGE_VERSION = 1

const storedDraftSchema = z.object({
	ownerId: z.uuid(),
	text: z.string().max(MESSAGE_TEXT_MAX_LENGTH),
})

/** Storage is outside the app's control: whatever does not parse is dropped. */
export const restoreComposerDraft = (stored: unknown): { ownerId: string | null; text: string } => {
	const parsed = storedDraftSchema.safeParse(stored)
	return parsed.success ? parsed.data : { ownerId: null, text: '' }
}

/**
 * What the user is typing in the chat: kept across tabs (the chat unmounts) and a reload of the
 * PWA; gone after it is sent and after logout.
 */
export const useComposerDraftStore = create<ComposerDraftState>()(
	persist(
		(set) => ({
			ownerId: null,
			text: '',
			claim: (userId) => {
				set((state) => (state.ownerId === userId ? state : { ownerId: userId, text: '' }))
			},
			setText: (text) => {
				set({ text })
			},
			clear: () => {
				set({ text: '' })
			},
		}),
		{
			name: COMPOSER_DRAFT_STORAGE_KEY,
			version: COMPOSER_DRAFT_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ ownerId, text }) => ({ ownerId, text }),
			migrate: () => ({ ownerId: null, text: '' }),
			merge: (stored, current) => ({ ...current, ...restoreComposerDraft(stored) }),
		},
	),
)
