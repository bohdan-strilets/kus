import { beforeEach, describe, expect, it, vi } from 'vitest'

// tests run in node: an in-memory localStorage, in place before the store reads it on import
vi.hoisted(() => {
	const data = new Map<string, string>()
	const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value)
		},
		removeItem: (key) => {
			data.delete(key)
		},
		clear: () => {
			data.clear()
		},
	}
	vi.stubGlobal('localStorage', storage)
})

import {
	COMPOSER_DRAFT_STORAGE_KEY,
	restoreComposerDraft,
	useComposerDraftStore,
} from './composer-draft-store'

const OWNER_ID = '0199b3a4-0000-7000-8000-00000000000a'
const OTHER_ID = '0199b3a4-0000-7000-8000-00000000000b'

const readStored = (): unknown =>
	JSON.parse(localStorage.getItem(COMPOSER_DRAFT_STORAGE_KEY) ?? 'null')

describe('composer draft', () => {
	beforeEach(() => {
		localStorage.clear()
		useComposerDraftStore.setState({ ownerId: OWNER_ID, text: '' })
	})

	it('keeps what is typed in storage, for its owner', () => {
		useComposerDraftStore.getState().setText('тарілка борщу і')

		expect(readStored()).toMatchObject({
			state: { ownerId: OWNER_ID, text: 'тарілка борщу і' },
		})
	})

	it('empties after sending', () => {
		const { setText, clear } = useComposerDraftStore.getState()
		setText('банан')
		clear()

		expect(useComposerDraftStore.getState().text).toBe('')
	})

	it('drops the text on logout or for another user, keeps it for the same one', () => {
		const { setText, claim } = useComposerDraftStore.getState()
		setText('чернетка')
		claim(OWNER_ID)
		expect(useComposerDraftStore.getState().text).toBe('чернетка')

		claim(null)
		expect(useComposerDraftStore.getState()).toMatchObject({ ownerId: null, text: '' })

		setText('інша')
		claim(OTHER_ID)
		expect(useComposerDraftStore.getState().text).toBe('')
	})

	describe('scroll-to-end requests', () => {
		beforeEach(() => {
			useComposerDraftStore.setState({ scrollToEndRequest: 0, isFocusRequested: false })
		})

		it('starts at 0', () => {
			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(0)
		})

		it('requestScrollToEnd adds one each time', () => {
			const { requestScrollToEnd } = useComposerDraftStore.getState()
			requestScrollToEnd()
			requestScrollToEnd()

			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(2)
		})

		it('requestFocus also asks to scroll to the end', () => {
			useComposerDraftStore.getState().requestFocus()

			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(1)
			expect(useComposerDraftStore.getState().isFocusRequested).toBe(true)
		})

		it('a second requestFocus asks again', () => {
			const { requestFocus } = useComposerDraftStore.getState()
			requestFocus()
			requestFocus()

			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(2)
		})

		it('other actions leave the counter alone', () => {
			const { setText, clear, claim, resolveFocus } = useComposerDraftStore.getState()
			setText('суп')
			clear()
			claim(OWNER_ID)
			claim(OTHER_ID)
			resolveFocus()

			expect(useComposerDraftStore.getState().scrollToEndRequest).toBe(0)
		})

		it('is not persisted', () => {
			useComposerDraftStore.getState().requestScrollToEnd()
			useComposerDraftStore.getState().setText('x')

			expect(JSON.stringify(readStored())).not.toContain('scrollToEndRequest')
		})
	})

	it('restores only a well-formed draft with an owner', () => {
		expect(restoreComposerDraft({ ownerId: OWNER_ID, text: 'суп' })).toEqual({
			ownerId: OWNER_ID,
			text: 'суп',
		})
		expect(restoreComposerDraft({ ownerId: 'nope', text: 'суп' })).toEqual({
			ownerId: null,
			text: '',
		})
		expect(restoreComposerDraft(null)).toEqual({ ownerId: null, text: '' })
	})
})
