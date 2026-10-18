// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, stubMatchMedia } from '@/shared/testing'

import { Composer } from './Composer'
import type { ComposerPhotoState } from './composer.types'

const TEXT = 'борщ'
const LINE_HEIGHT_PX = 20
const WRAPPED_SCROLL_HEIGHT_PX = 200

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
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

const getField = (): HTMLTextAreaElement => screen.getByRole<HTMLTextAreaElement>('textbox')

/** jsdom has no layout: pretend the text wraps so the composer switches to the long layout. */
const stubWrappedText = (): void => {
	vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(
		WRAPPED_SCROLL_HEIGHT_PX,
	)
	const original = window.getComputedStyle.bind(window)
	vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
		const style = original(element, pseudo)
		if (!(element instanceof HTMLTextAreaElement)) return style
		return new Proxy(style, {
			get: (target, property) => {
				if (property === 'paddingTop' || property === 'paddingBottom') return '0px'
				if (property === 'lineHeight') return `${LINE_HEIGHT_PX}px`
				const value: unknown = Reflect.get(target, property, target)
				return typeof value === 'function' ? (value.bind(target) as unknown) : value
			},
		})
	})
}

interface RenderOptions {
	value?: string
	isVoiceEnabled?: boolean
	isMultiline?: boolean
	photo?: ComposerPhotoState
}

const renderComposer = ({
	value = TEXT,
	isVoiceEnabled = true,
	isMultiline = false,
	photo,
}: RenderOptions = {}) => {
	if (isMultiline) stubWrappedText()
	const onSubmit = vi.fn()
	const onVoiceStart = vi.fn()
	const onPhotoPick = vi.fn()
	const view = renderWithProviders(
		<Composer
			value={value}
			onValueChange={() => undefined}
			onSubmit={onSubmit}
			onVoiceStart={onVoiceStart}
			onPhotoPick={onPhotoPick}
			isVoiceEnabled={isVoiceEnabled}
			photo={photo}
		/>,
	)
	// the field is controlled: typing one more char is what triggers the measuring
	if (isMultiline) fireEvent.change(getField(), { target: { value: `${value}!` } })
	return { onSubmit, onVoiceStart, onPhotoPick, view }
}

describe('Composer buttons keep the field focused (iOS keyboard stays up)', () => {
	const getCamera = () => screen.getByRole('button', { name: 'Додати фото їжі' })
	const getSend = () => screen.getByRole('button', { name: 'Надіслати' })

	describe.each(['pointerDown', 'mouseDown'] as const)('%s default is prevented', (eventName) => {
		it('on the camera button', () => {
			renderComposer()

			expect(fireEvent[eventName](getCamera())).toBe(false)
		})

		it('on the send button next to the mic (single line, voice on)', () => {
			renderComposer()

			expect(fireEvent[eventName](getSend())).toBe(false)
		})

		it('on the send button without voice', () => {
			renderComposer({ isVoiceEnabled: false })

			expect(fireEvent[eventName](getSend())).toBe(false)
		})

		it('on the send button of the long layout', () => {
			renderComposer({ isMultiline: true })
			expect(screen.getByText('Kusik розбере все на окремі продукти')).toBeTruthy()

			expect(fireEvent[eventName](getSend())).toBe(false)
		})

		it('on the mic button', () => {
			renderComposer({ value: '' })

			expect(
				fireEvent[eventName](screen.getByRole('button', { name: 'Голосове повідомлення' })),
			).toBe(false)
		})
	})

	describe.each([
		['single line, voice on', {}],
		['single line, no voice', { isVoiceEnabled: false }],
		['long layout', { isMultiline: true }],
	] as const)('a tap on «надіслати», %s', (_name, options: RenderOptions) => {
		it('sends on the first tap and the field stays focused', async () => {
			const user = userEvent.setup()
			const { onSubmit } = renderComposer(options)
			getField().focus()

			await user.click(getSend())

			expect(onSubmit).toHaveBeenCalledTimes(1)
			expect(document.activeElement).toBe(getField())
		})
	})

	it('a tap on the camera keeps the field focused', async () => {
		const user = userEvent.setup()
		renderComposer()
		getField().focus()

		await user.click(getCamera())

		expect(document.activeElement).toBe(getField())
	})

	// guard: preventing pointerdown/mousedown must not stop the click that opens the picker
	it('still opens the file picker on a camera click', async () => {
		const user = userEvent.setup()
		renderComposer()
		const pickerClick = vi.spyOn(HTMLInputElement.prototype, 'click')

		await user.click(getCamera())

		expect(pickerClick).toHaveBeenCalledTimes(1)
		expect(pickerClick.mock.contexts[0]).toBe(document.querySelector('input[type="file"]'))
	})
})

describe('Composer onFieldPress', () => {
	it('is called by a click on the field that is focused already', async () => {
		const user = userEvent.setup()
		const onFieldPress = vi.fn()
		renderWithProviders(
			<Composer
				value=""
				onValueChange={() => undefined}
				onSubmit={() => undefined}
				onFieldPress={onFieldPress}
			/>,
		)
		getField().focus()

		await user.click(getField())

		expect(onFieldPress).toHaveBeenCalled()
	})

	it('is not called by a tap on a button', async () => {
		const user = userEvent.setup()
		const onFieldPress = vi.fn()
		renderWithProviders(
			<Composer
				value={TEXT}
				onValueChange={() => undefined}
				onSubmit={() => undefined}
				onFieldPress={onFieldPress}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'Додати фото їжі' }))

		expect(onFieldPress).not.toHaveBeenCalled()
	})

	it('is optional: a click on the field without it does not throw', async () => {
		const user = userEvent.setup()
		renderComposer()

		await user.click(getField())

		expect(document.activeElement).toBe(getField())
	})
})

describe('the «прибрати фото» button keeps the field focused', () => {
	const photo: ComposerPhotoState = {
		status: 'ready',
		previewUrl: 'blob:http://localhost/plate',
		errorKey: null,
		onRemove: vi.fn(),
	}
	const getRemove = () => screen.getByRole('button', { name: 'Прибрати фото' })

	beforeEach(() => {
		vi.mocked(photo.onRemove).mockClear()
	})

	it.each(['pointerDown', 'mouseDown'] as const)('prevents the default on %s', (eventName) => {
		renderComposer({ photo })

		expect(fireEvent[eventName](getRemove())).toBe(false)
	})

	it('removes on the first tap and the field stays focused', async () => {
		const user = userEvent.setup()
		renderComposer({ photo })
		getField().focus()

		await user.click(getRemove())

		expect(photo.onRemove).toHaveBeenCalledTimes(1)
		expect(document.activeElement).toBe(getField())
	})
})
