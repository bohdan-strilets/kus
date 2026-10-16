// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as SharedApi from '@/shared/api'
import { touchSession } from '@/shared/api'
import { createWrapper, renderWithProviders } from '@/shared/testing'

import { getPhotoTileHeight } from './get-photo-tile-height'
import { PhotoTile } from './PhotoTile'

vi.mock('@/shared/api', async (importOriginal) => ({
	...(await importOriginal<typeof SharedApi>()),
	touchSession: vi.fn(),
}))

const touchSessionMock = vi.mocked(touchSession)

const FILE_ID = '0199b3a4-0000-7000-8000-0000000000f1'
const THUMB_URL = `/api/v1/photos/${FILE_ID}?variant=thumb`
const BLOB_URL = 'blob:http://localhost/sent'
const ALT = 'Фото їжі'
const LOADING = 'Фото завантажується'
const MISSING = 'Фото не збереглося'
const LOAD_FAILED = 'Не вдалося завантажити'
const RETRY = 'Повторити'
const MIN_TAP_TARGET_CLASS = 'min-h-tap'

const baseProps = { width: 1568, height: 1176, alt: ALT } as const

const getImage = (container: HTMLElement): HTMLImageElement => {
	const image = container.querySelector('img')
	if (!image) throw new Error('no <img> in the tile')
	return image
}
const hasSkeleton = (container: HTMLElement): boolean =>
	container.querySelector('span[aria-hidden="true"].absolute') !== null

interface Deferred {
	promise: Promise<boolean>
	resolve: (value: boolean) => void
}

const createDeferred = (): Deferred => {
	let resolve: (value: boolean) => void = () => undefined
	const promise = new Promise<boolean>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

/** Waits until the retry ping ends and the fresh <img> is mounted. */
const findImage = (container: HTMLElement): Promise<HTMLImageElement> =>
	waitFor(() => getImage(container))

beforeEach(() => {
	touchSessionMock.mockReset()
	touchSessionMock.mockResolvedValue(true)
})

afterEach(cleanup)

describe('PhotoTile', () => {
	it('says the photo is gone, without a retry, when there is no file', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={null} />)

		expect(screen.getByRole('img', { name: MISSING })).toBeTruthy()
		expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
		expect(container.querySelector('img')).toBeNull()
	})

	it('keeps the height of the missing tile the same as of a loaded one', () => {
		renderWithProviders(<PhotoTile {...baseProps} fileId={null} />)

		expect(screen.getByRole('img', { name: MISSING }).style.height).toBe(
			`${getPhotoTileHeight(1568, 1176)}px`,
		)
	})

	it('shows a skeleton and a hidden lazy thumb while the server copy loads', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		const image = getImage(container)

		expect(hasSkeleton(container)).toBe(true)
		expect(image.getAttribute('src')).toBe(THUMB_URL)
		expect(image.getAttribute('loading')).toBe('lazy')
		expect(image.getAttribute('decoding')).toBe('async')
		expect(image.style.opacity).toBe('0')
	})

	it('names the tile «loading» until the picture loads and hides the image from the reader', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		expect(screen.getByRole('status', { name: LOADING })).toBeTruthy()
		expect(screen.queryByRole('img', { name: ALT })).toBeNull()
		expect(getImage(container).getAttribute('alt')).toBe('')
	})

	it('names the tile by its alt after the picture loads', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		fireEvent.load(getImage(container))

		expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
		expect(screen.queryByRole('status', { name: LOADING })).toBeNull()
	})

	it('names a local preview by its alt at once', () => {
		renderWithProviders(<PhotoTile {...baseProps} fileId={null} previewUrl={BLOB_URL} />)

		expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
		expect(screen.queryByRole('status', { name: LOADING })).toBeNull()
	})

	it('names the tile «loading» again after a retry', async () => {
		const user = userEvent.setup()
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		fireEvent.error(getImage(container))

		await user.click(screen.getByRole('button', { name: RETRY }))

		expect(screen.getByRole('status', { name: LOADING })).toBeTruthy()
		fireEvent.load(await findImage(container))
		expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
	})

	it('sets the height from the proportions before the picture loads', () => {
		renderWithProviders(<PhotoTile fileId={FILE_ID} width={900} height={1600} alt={ALT} />)

		expect(screen.getByRole('status', { name: LOADING }).style.height).toBe('330px')
	})

	it('drops the skeleton and shows the picture after it loads', async () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		fireEvent.load(getImage(container))

		await waitFor(() => {
			expect(getImage(container).style.opacity).toBe('1')
		})
		expect(hasSkeleton(container)).toBe(false)
	})

	it('loads without errors when the user prefers reduced motion', async () => {
		const { container } = renderWithProviders(
			<MotionConfig reducedMotion="always">
				<PhotoTile {...baseProps} fileId={FILE_ID} />
			</MotionConfig>,
		)

		fireEvent.load(getImage(container))

		await waitFor(() => {
			expect(getImage(container).style.opacity).toBe('1')
		})
	})

	it('shows the error tile with a retry when the server copy fails', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		fireEvent.error(getImage(container))

		expect(screen.getByText(LOAD_FAILED)).toBeTruthy()
		expect(screen.getByRole('button', { name: RETRY })).toBeTruthy()
		expect(container.querySelector('img')).toBeNull()
	})

	it('keeps the tile height in the error state', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		fireEvent.error(getImage(container))

		expect(screen.getByRole('group').style.height).toBe(`${getPhotoTileHeight(1568, 1176)}px`)
	})

	it('makes the retry a tap target', () => {
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)

		fireEvent.error(getImage(container))

		expect(screen.getByRole('button', { name: RETRY }).className).toContain(MIN_TAP_TARGET_CLASS)
	})

	it('mounts a fresh <img> with a skeleton on retry, without reloading the page', async () => {
		const user = userEvent.setup()
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		const failed = getImage(container)
		fireEvent.error(failed)

		await user.click(screen.getByRole('button', { name: RETRY }))

		const again = await findImage(container)
		expect(again).not.toBe(failed)
		expect(again.getAttribute('src')).toBe(THUMB_URL)
		expect(hasSkeleton(container)).toBe(true)
		expect(screen.queryByText(LOAD_FAILED)).toBeNull()
	})

	it('shows the picture after a retry succeeds', async () => {
		const user = userEvent.setup()
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		fireEvent.error(getImage(container))
		await user.click(screen.getByRole('button', { name: RETRY }))

		fireEvent.load(await findImage(container))

		await waitFor(() => {
			expect(getImage(container).style.opacity).toBe('1')
		})
		expect(hasSkeleton(container)).toBe(false)
	})

	it('can fail again after a retry and offer another one', async () => {
		const user = userEvent.setup()
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		fireEvent.error(getImage(container))
		await user.click(screen.getByRole('button', { name: RETRY }))

		fireEvent.error(await findImage(container))

		expect(screen.getByRole('button', { name: RETRY })).toBeTruthy()
	})

	it('retries with the keyboard', async () => {
		const user = userEvent.setup()
		const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
		fireEvent.error(getImage(container))

		await user.tab()
		expect(document.activeElement).toBe(screen.getByRole('button', { name: RETRY }))
		await user.keyboard('{Enter}')

		expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
		expect((await findImage(container)).getAttribute('src')).toBe(THUMB_URL)
	})

	describe('retry after an expired session', () => {
		const failThumb = (container: HTMLElement): void => {
			fireEvent.error(getImage(container))
		}

		it('renews the session once, shows only the skeleton meanwhile, then mounts a new <img>', async () => {
			const ping = createDeferred()
			touchSessionMock.mockReturnValue(ping.promise)
			const user = userEvent.setup()
			const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
			const failed = getImage(container)
			fireEvent.error(failed)

			await user.click(screen.getByRole('button', { name: RETRY }))

			expect(touchSessionMock).toHaveBeenCalledTimes(1)
			expect(screen.getByRole('status', { name: LOADING })).toBeTruthy()
			expect(hasSkeleton(container)).toBe(true)
			expect(container.querySelector('img')).toBeNull()
			expect(screen.queryByRole('button', { name: RETRY })).toBeNull()

			ping.resolve(true)
			const again = await findImage(container)

			expect(again).not.toBe(failed)
			expect(again.getAttribute('src')).toBe(THUMB_URL)
			fireEvent.load(again)
			expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
			expect(touchSessionMock).toHaveBeenCalledTimes(1)
		})

		it('mounts the <img> again even when the session could not be renewed', async () => {
			touchSessionMock.mockResolvedValue(false)
			const user = userEvent.setup()
			const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
			const failed = getImage(container)
			fireEvent.error(failed)

			await user.click(screen.getByRole('button', { name: RETRY }))

			const again = await findImage(container)
			expect(again).not.toBe(failed)
			expect(again.getAttribute('src')).toBe(THUMB_URL)
		})

		it('ignores a second tap in the same tick and bumps the attempt once', async () => {
			const ping = createDeferred()
			touchSessionMock.mockReturnValue(ping.promise)
			const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
			failThumb(container)
			const button = screen.getByRole('button', { name: RETRY })

			fireEvent.click(button)
			fireEvent.click(button)
			ping.resolve(true)
			await findImage(container)

			expect(touchSessionMock).toHaveBeenCalledTimes(1)
			// one attempt: a failure now gives the retry button, and one more ping is allowed
			failThumb(container)
			fireEvent.click(screen.getByRole('button', { name: RETRY }))
			await findImage(container)
			expect(touchSessionMock).toHaveBeenCalledTimes(2)
		})

		it('runs another full cycle when the picture fails again', async () => {
			const user = userEvent.setup()
			const { container } = renderWithProviders(<PhotoTile {...baseProps} fileId={FILE_ID} />)
			failThumb(container)

			await user.click(screen.getByRole('button', { name: RETRY }))
			fireEvent.error(await findImage(container))
			await user.click(screen.getByRole('button', { name: RETRY }))
			const third = await findImage(container)

			expect(touchSessionMock).toHaveBeenCalledTimes(2)
			fireEvent.load(third)
			expect(screen.getByRole('img', { name: ALT })).toBeTruthy()
		})

		it('does not throw when unmounted while the session is being renewed', async () => {
			const ping = createDeferred()
			touchSessionMock.mockReturnValue(ping.promise)
			const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
			const { container, unmount } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={FILE_ID} />,
			)
			failThumb(container)
			fireEvent.click(screen.getByRole('button', { name: RETRY }))

			unmount()
			ping.resolve(true)
			await act(async () => {
				await ping.promise
			})

			expect(errors).not.toHaveBeenCalled()
			errors.mockRestore()
		})
	})

	describe('with a local preview', () => {
		it('shows the preview at once, without a skeleton and without asking the server', () => {
			const { container } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={null} previewUrl={BLOB_URL} />,
			)
			const image = getImage(container)

			expect(image.getAttribute('src')).toBe(BLOB_URL)
			expect(hasSkeleton(container)).toBe(false)
			expect(image.style.opacity).toBe('1')
			expect(container.innerHTML).not.toContain('/photos/')
			expect(screen.queryByText(MISSING)).toBeNull()
		})

		it('does not request the server copy of a stored photo while the preview works', () => {
			const { container } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={FILE_ID} previewUrl={BLOB_URL} />,
			)

			expect(getImage(container).getAttribute('src')).toBe(BLOB_URL)
			expect(container.innerHTML).not.toContain(THUMB_URL)
		})

		it('falls back to the server thumb through the skeleton when the blob is broken', () => {
			const { container } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={FILE_ID} previewUrl={BLOB_URL} />,
			)

			fireEvent.error(getImage(container))

			expect(getImage(container).getAttribute('src')).toBe(THUMB_URL)
			expect(hasSkeleton(container)).toBe(true)
			expect(screen.queryByText(LOAD_FAILED)).toBeNull()
		})

		it('shows the missing tile when the blob is broken and there is no file', () => {
			const { container } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={null} previewUrl={BLOB_URL} />,
			)

			fireEvent.error(getImage(container))

			expect(screen.getByRole('img', { name: MISSING })).toBeTruthy()
			expect(screen.queryByRole('button', { name: RETRY })).toBeNull()
		})

		it('shows the error tile when the fallback thumb fails too', () => {
			const { container } = renderWithProviders(
				<PhotoTile {...baseProps} fileId={FILE_ID} previewUrl={BLOB_URL} />,
			)
			fireEvent.error(getImage(container))

			fireEvent.error(getImage(container))

			expect(screen.getByRole('button', { name: RETRY })).toBeTruthy()
		})

		it('keeps the same <img> when the outbox preview becomes the stored photo', () => {
			// rerender keeps the wrapper only when it is a render option, not part of the tree
			const { container, rerender } = render(
				<PhotoTile {...baseProps} fileId={null} previewUrl={BLOB_URL} />,
				{ wrapper: createWrapper() },
			)
			const before = getImage(container)

			act(() => {
				rerender(<PhotoTile {...baseProps} fileId={FILE_ID} previewUrl={BLOB_URL} />)
			})

			expect(getImage(container)).toBe(before)
			expect(before.getAttribute('src')).toBe(BLOB_URL)
		})
	})
})
