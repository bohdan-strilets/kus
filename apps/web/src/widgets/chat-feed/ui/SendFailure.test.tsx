// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SendError } from '@/features/send-message'
import { renderWithProviders } from '@/shared/testing'

import type { FeedDismiss, RetryParams } from '../model/feed.types'
import { SendFailure } from './SendFailure'

const RETRY: RetryParams = { clientMessageId: 'c1', text: 'борщ' }
const DISMISS: FeedDismiss = { target: 'outbox', id: 'c1' }
const ERROR: SendError = { messageKey: 'chat.networkError', canRetry: true }

afterEach(cleanup)

describe('SendFailure', () => {
	it('offers «Спробувати ще» and «Прибрати» for a fresh failure', () => {
		renderWithProviders(
			<SendFailure
				error={ERROR}
				retry={RETRY}
				dismiss={DISMISS}
				staleSince={null}
				onRetry={vi.fn()}
				onDismiss={vi.fn()}
			/>,
		)

		expect(screen.getByRole('button', { name: 'Спробувати ще' })).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Прибрати' })).toBeTruthy()
		expect(screen.queryByText(/запишеться на сьогодні/)).toBeNull()
	})

	it('says when it was not sent and that a resend logs it today, with «Надіслати» and «Прибрати»', () => {
		const onRetry = vi.fn()
		const onDismiss = vi.fn()
		renderWithProviders(
			<SendFailure
				error={ERROR}
				retry={RETRY}
				dismiss={DISMISS}
				staleSince="2026-11-08"
				onRetry={onRetry}
				onDismiss={onDismiss}
			/>,
		)

		expect(
			screen.getByText('Не надіслано 08.11. Якщо надіслати зараз, запишеться на сьогодні.'),
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: 'Спробувати ще' })).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Надіслати' }))
		expect(onRetry).toHaveBeenCalledWith(RETRY)
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати' }))
		expect(onDismiss).toHaveBeenCalledWith(DISMISS)
	})
})
