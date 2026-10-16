// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { unlockSound } from '@/shared/lib'
import { renderHookWithProviders } from '@/shared/testing'

import { deliverMessage } from './deliver-message'
import { useSendMessage } from './use-send-message'

vi.mock('./deliver-message', () => ({ deliverMessage: vi.fn(() => Promise.resolve()) }))
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	unlockSound: vi.fn(),
}))

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

const setup = () =>
	renderHookWithProviders(() => useSendMessage(), { queryClient: new QueryClient() })

describe('useSendMessage', () => {
	it('unlocks the audio synchronously in the send gesture, before the message leaves', () => {
		const { result } = setup()

		act(() => {
			result.current.send({ text: ' яблуко ' })
		})

		expect(unlockSound).toHaveBeenCalledTimes(1)
		expect(deliverMessage).toHaveBeenCalledTimes(1)
		// the gesture is the only moment iOS lets the context start: unlock must come first
		expect(vi.mocked(unlockSound).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(deliverMessage).mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY,
		)
		expect(deliverMessage).toHaveBeenCalledWith(
			expect.any(QueryClient),
			expect.objectContaining({ text: 'яблуко' }),
		)
	})

	it('sends a photo with its thumbnail and an own preview URL, and no photo id yet', () => {
		const createObjectURL = vi.fn(() => 'blob:http://localhost/outbox')
		URL.createObjectURL = createObjectURL
		const { result } = setup()
		const blob = new Blob(['jpeg'])

		act(() => {
			result.current.send({
				text: '',
				photo: {
					blob,
					base64: 'AAAA',
					thumbBase64: 'TTTT',
					width: 800,
					height: 600,
					previewUrl: 'blob:http://localhost/draft',
				},
			})
		})

		expect(createObjectURL).toHaveBeenCalledWith(blob)
		expect(deliverMessage).toHaveBeenCalledWith(
			expect.any(QueryClient),
			expect.objectContaining({
				photo: {
					previewUrl: 'blob:http://localhost/outbox',
					base64: 'AAAA',
					thumbBase64: 'TTTT',
					mimeType: 'image/jpeg',
					width: 800,
					height: 600,
				},
			}),
		)
		const params = vi.mocked(deliverMessage).mock.calls[0]?.[1]
		expect(params?.photoId).toBeUndefined()
		expect(params?.isRetry).toBeUndefined()
	})

	it('sends a text without a photo with no photo at all', () => {
		const { result } = setup()

		act(() => {
			result.current.send({ text: 'банан', photo: null })
		})

		expect(vi.mocked(deliverMessage).mock.calls[0]?.[1].photo).toBeUndefined()
	})

	it('passes the photo id of a retry through, with isRetry', () => {
		const { result } = setup()
		const params = {
			clientMessageId: '0199b3a4-0000-7000-8000-0000000000aa',
			text: '',
			photoId: '0199b3a4-0000-7000-8000-0000000000c1',
		}

		act(() => {
			result.current.retry(params)
		})

		expect(deliverMessage).toHaveBeenCalledWith(expect.any(QueryClient), {
			...params,
			isRetry: true,
		})
	})

	it('unlocks the audio in the retry tap too', () => {
		const { result } = setup()
		const params = { clientMessageId: '0199b3a4-0000-7000-8000-0000000000aa', text: 'суп' }

		act(() => {
			result.current.retry(params)
		})

		expect(unlockSound).toHaveBeenCalledTimes(1)
		expect(deliverMessage).toHaveBeenCalledWith(expect.any(QueryClient), {
			...params,
			isRetry: true,
		})
	})
})
