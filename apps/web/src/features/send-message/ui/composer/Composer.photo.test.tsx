// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, stubMatchMedia } from '@/shared/testing'

import { shouldShowQuickChips } from '../../lib/should-show-quick-chips'
import { useComposerDraftStore } from '../../model/composer-draft-store'
import { type PhotoDraftPhoto, usePhotoDraftStore } from '../../model/photo-draft-store'
import { QuickChips } from '../quick-chips/QuickChips'
import { Composer } from './Composer'
import type { ComposerPhotoState } from './composer.types'

const PHOTO: PhotoDraftPhoto = {
	blob: new Blob(['jpeg']),
	base64: 'AAAA',
	width: 800,
	height: 600,
	previewUrl: 'blob:http://localhost/plate',
}

beforeAll(() => {
	stubMatchMedia()
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = () => undefined
			unobserve = () => undefined
			disconnect = () => undefined
		},
	)
	URL.revokeObjectURL = vi.fn()
})

beforeEach(() => {
	useComposerDraftStore.setState({ text: '', isFocusRequested: false })
	usePhotoDraftStore.getState().clear()
})

afterEach(cleanup)

const setPhoto = (state: Partial<ReturnType<typeof usePhotoDraftStore.getState>>): void => {
	act(() => {
		usePhotoDraftStore.setState(state)
	})
}

const setReady = (): void => {
	setPhoto({ status: 'ready', photo: PHOTO, errorKey: null })
}

/** The wiring of the chat screen (pages/chat/ChatPage): stores in, one submit that sends and clears. */
const Harness = ({ onSend }: { onSend: (params: { text: string; photo: unknown }) => void }) => {
	const text = useComposerDraftStore((state) => state.text)
	const setText = useComposerDraftStore((state) => state.setText)
	const clearText = useComposerDraftStore((state) => state.clear)
	const photoDraft = usePhotoDraftStore()
	const photo: ComposerPhotoState = {
		status: photoDraft.status,
		previewUrl: photoDraft.photo?.previewUrl ?? null,
		errorKey: photoDraft.errorKey,
		onRemove: photoDraft.clear,
	}
	return (
		<>
			<QuickChips
				isShown={shouldShowQuickChips({
					isEnabled: true,
					draftText: text,
					photoStatus: photoDraft.status,
				})}
			/>
			<Composer
				value={text}
				onValueChange={setText}
				onSubmit={() => {
					onSend({ text, photo: photoDraft.photo })
					clearText()
					photoDraft.clear()
				}}
				photo={photo}
			/>
		</>
	)
}

const renderHarness = () => {
	const onSend = vi.fn()
	renderWithProviders(<Harness onSend={onSend} />)
	return onSend
}

const getField = (): HTMLTextAreaElement => screen.getByRole<HTMLTextAreaElement>('textbox')
const type = (text: string): void => {
	fireEvent.change(getField(), { target: { value: text } })
}
const queryMic = () => screen.queryByRole('button', { name: 'Голосове повідомлення' })
const getSend = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Надіслати' })

describe('photo preview states', () => {
	it('ready: thumbnail, hint, remove button and a caption placeholder', () => {
		renderHarness()
		setReady()

		expect(screen.getByRole('img', { name: 'Вибране фото' }).getAttribute('src')).toBe(
			PHOTO.previewUrl,
		)
		expect(screen.getByText('Можна додати підпис або надіслати так')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Прибрати фото' })).toBeTruthy()
		expect(getField().placeholder).toBe('Підпис, наприклад: «без олії»')
	})

	it('processing: status line instead of a picture, caption placeholder', () => {
		renderHarness()
		setPhoto({ status: 'processing', photo: null })

		expect(screen.getByRole('status').textContent).toBe('Готую фото…')
		expect(screen.queryByRole('img', { name: 'Вибране фото' })).toBeNull()
		expect(getField().placeholder).toBe('Підпис, наприклад: «без олії»')
	})

	it('error: the title and the concrete reason from the error key', () => {
		renderHarness()
		setPhoto({ status: 'error', photo: null, errorKey: 'chat.photoTooLarge' })

		const alert = screen.getByRole('alert')
		expect(alert.textContent).toContain('Не вдалося відкрити фото')
		expect(alert.textContent).toContain('Вибери фото меншого розміру.')
		expect(screen.queryByRole('button', { name: /Повторити/ })).toBeNull()
	})

	it('without a photo: the usual placeholder and no preview', () => {
		renderHarness()

		expect(getField().placeholder).toBe('Напиши, що їси, або спитай…')
		expect(screen.queryByRole('button', { name: 'Прибрати фото' })).toBeNull()
	})

	it.each(['ready', 'processing', 'error'] as const)('%s: «прибрати» drops the photo', (status) => {
		renderHarness()
		setPhoto({
			status,
			photo: status === 'ready' ? PHOTO : null,
			errorKey: status === 'error' ? 'chat.photoUnsupported' : null,
		})

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фото' }))

		expect(usePhotoDraftStore.getState().status).toBe('idle')
		expect(screen.queryByRole('button', { name: 'Прибрати фото' })).toBeNull()
	})
})

describe('(1) the text draft survives a photo coming and going', () => {
	it('keeps the words when a photo is added and when it is removed', () => {
		renderHarness()
		type('курка з рисом')

		setReady()
		expect(getField().value).toBe('курка з рисом')
		expect(useComposerDraftStore.getState().text).toBe('курка з рисом')

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фото' }))
		expect(getField().value).toBe('курка з рисом')
		expect(useComposerDraftStore.getState().text).toBe('курка з рисом')
	})

	it('keeps the words through processing and a failed photo too', () => {
		renderHarness()
		type('суп')

		setPhoto({ status: 'processing', photo: null })
		setPhoto({ status: 'error', errorKey: 'chat.photoUnsupported' })

		expect(getField().value).toBe('суп')
	})
})

describe('(2) the quick chips hide while a photo is there', () => {
	const queryChip = () => screen.queryByRole('button', { name: 'Додати талію' })

	it('without a photo a chip puts its draft into the field', () => {
		renderHarness()

		fireEvent.click(screen.getByRole('button', { name: 'Додати талію' }))

		expect(useComposerDraftStore.getState().text).toBe('талія ')
	})

	it.each(['ready', 'processing', 'error'] as const)('no chips with a %s photo', async (status) => {
		renderHarness()
		setPhoto({
			status,
			photo: status === 'ready' ? PHOTO : null,
			errorKey: status === 'error' ? 'chat.photoUnsupported' : null,
		})

		await waitFor(() => {
			expect(queryChip()).toBeNull()
		})
	})

	it('come back after the photo is removed, and the draft is not lost', async () => {
		renderHarness()
		setReady()
		await waitFor(() => {
			expect(queryChip()).toBeNull()
		})

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фото' }))

		await waitFor(() => {
			expect(queryChip()).toBeTruthy()
		})
		fireEvent.click(screen.getByRole('button', { name: 'Додати талію' }))
		expect(useComposerDraftStore.getState().text).toBe('талія ')
	})

	it('hide once there are words, as before', () => {
		expect(shouldShowQuickChips({ isEnabled: true, draftText: 'курка', photoStatus: 'idle' })).toBe(
			false,
		)
	})
})

describe('(3) the right slot: mic without a photo, «надіслати» with one', () => {
	it('shows the mic without a photo', () => {
		renderHarness()

		expect(queryMic()).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Надіслати' })).toBeNull()
	})

	it.each(['ready', 'processing', 'error'] as const)('%s: «надіслати», no mic', (status) => {
		renderHarness()
		setPhoto({ status, photo: status === 'ready' ? PHOTO : null, errorKey: null })

		expect(queryMic()).toBeNull()
		expect(getSend()).toBeTruthy()
	})

	it('brings the mic back once the photo is removed', () => {
		renderHarness()
		setReady()

		fireEvent.click(screen.getByRole('button', { name: 'Прибрати фото' }))

		expect(queryMic()).toBeTruthy()
	})
})

describe('(4) sending with each photo state', () => {
	it('ready: sends the photo without any words', () => {
		const onSend = renderHarness()
		setReady()

		expect(getSend().disabled).toBe(false)
		fireEvent.click(getSend())

		expect(onSend).toHaveBeenCalledWith({ text: '', photo: PHOTO })
		expect(usePhotoDraftStore.getState().status).toBe('idle')
	})

	it('ready: sends the photo with a caption', () => {
		const onSend = renderHarness()
		setReady()
		type('без олії')

		fireEvent.click(getSend())

		expect(onSend).toHaveBeenCalledWith({ text: 'без олії', photo: PHOTO })
		expect(useComposerDraftStore.getState().text).toBe('')
	})

	it('processing: «надіслати» is off, with or without words', () => {
		const onSend = renderHarness()
		setPhoto({ status: 'processing', photo: null })
		expect(getSend().disabled).toBe(true)

		type('суп')
		expect(getSend().disabled).toBe(true)
		fireEvent.submit(getField().closest('form') as HTMLFormElement)

		expect(onSend).not.toHaveBeenCalled()
		expect(useComposerDraftStore.getState().text).toBe('суп')
	})

	it('error: off without words', () => {
		const onSend = renderHarness()
		setPhoto({ status: 'error', photo: null, errorKey: 'chat.photoUnsupported' })

		expect(getSend().disabled).toBe(true)
		fireEvent.submit(getField().closest('form') as HTMLFormElement)
		expect(onSend).not.toHaveBeenCalled()
	})

	it('error: with words sends only the text and drops the failed photo', () => {
		const onSend = renderHarness()
		setPhoto({ status: 'error', photo: null, errorKey: 'chat.photoUnsupported' })
		type('борщ')

		expect(getSend().disabled).toBe(false)
		fireEvent.click(getSend())

		expect(onSend).toHaveBeenCalledTimes(1)
		expect(onSend).toHaveBeenCalledWith({ text: 'борщ', photo: null })
		expect(usePhotoDraftStore.getState().status).toBe('idle')
		expect(usePhotoDraftStore.getState().errorKey).toBeNull()
		expect(screen.queryByRole('alert')).toBeNull()
	})
})
