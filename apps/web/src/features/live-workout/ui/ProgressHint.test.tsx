// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { ProgressHint } from './ProgressHint'

afterEach(cleanup)

describe('ProgressHint', () => {
	it('[Взяти] calls onTake', () => {
		const onTake = vi.fn()
		renderWithProviders(<ProgressHint reps={12} weightKg={20} onTake={onTake} />)

		fireEvent.click(screen.getByRole('button', { name: 'Взяти' }))

		expect(onTake).toHaveBeenCalledTimes(1)
	})

	it('[Взяти] gets a ≥ 44px tap area from an extended ::after hitbox', () => {
		renderWithProviders(<ProgressHint reps={12} weightKg={20} onTake={vi.fn()} />)

		const classes = screen.getByRole('button', { name: 'Взяти' }).className.split(' ')

		// jsdom cannot measure pseudo-elements, so the hitbox is checked by its classes
		expect(classes).toContain('relative')
		expect(classes).toContain('after:absolute')
		expect(classes).toContain('after:-inset-y-0.5')
	})
})
