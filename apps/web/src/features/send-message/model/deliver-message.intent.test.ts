import { QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { postMessage } from '../api/send-message'
import { deliverMessage } from './deliver-message'
import { useOutboxStore } from './outbox-store'

vi.mock('../api/send-message', () => ({ postMessage: vi.fn() }))
vi.mock('@/shared/lib', async (importOriginal) => ({
	...(await importOriginal<object>()),
	playSound: vi.fn(),
}))

const CLIENT_ID = '0199b3a4-0000-7000-8000-0000000000aa'

describe('deliverMessage with an intent', () => {
	beforeEach(() => {
		useOutboxStore.setState({ items: {} })
		vi.mocked(postMessage).mockReset()
		vi.mocked(postMessage).mockRejectedValue(new AxiosError('Network Error'))
	})

	it('sends the intent and keeps it in the outbox of a failed message', async () => {
		await deliverMessage(new QueryClient(), {
			clientMessageId: CLIENT_ID,
			text: 'борщ на 3 літри',
			intent: 'new_recipe',
		})

		expect(vi.mocked(postMessage).mock.calls[0]?.[0]).toMatchObject({ intent: 'new_recipe' })
		expect(useOutboxStore.getState().items[CLIENT_ID]).toMatchObject({
			status: 'failed',
			intent: 'new_recipe',
		})
	})

	it('a resend without the intent in its params still carries the stored one', async () => {
		await deliverMessage(new QueryClient(), {
			clientMessageId: CLIENT_ID,
			text: 'борщ на 3 літри',
			intent: 'new_recipe',
		})
		await deliverMessage(new QueryClient(), {
			clientMessageId: CLIENT_ID,
			text: 'борщ на 3 літри',
			isRetry: true,
		})

		expect(vi.mocked(postMessage).mock.calls[1]?.[0]).toMatchObject({ intent: 'new_recipe' })
	})

	it('a plain message has no intent in the request', async () => {
		await deliverMessage(new QueryClient(), { clientMessageId: CLIENT_ID, text: 'яблуко' })

		expect(vi.mocked(postMessage).mock.calls[0]?.[0]).not.toHaveProperty('intent')
	})
})
