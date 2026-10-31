// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { InlineError } from './InlineError'

afterEach(cleanup)

describe('InlineError', () => {
	it('gives the retry button the accessible name «Повторити» and calls back on a tap', () => {
		const onRetry = vi.fn()
		renderWithProviders(<InlineError message="Не вдалося." onRetry={onRetry} />)

		fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))

		expect(onRetry).toHaveBeenCalledTimes(1)
	})
})
