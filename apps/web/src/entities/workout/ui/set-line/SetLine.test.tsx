// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { SetLine } from './SetLine'

afterEach(cleanup)

describe('SetLine', () => {
	it('renders warm-up, folded sets and a record with a text for screen readers', () => {
		const { container } = render(
			<SetLine
				sets={{
					unit: null,
					segments: [
						{ kind: 'warmup', text: '40×10' },
						{ kind: 'work', text: '60×8', multiplier: 2 },
						{ kind: 'record', text: '70×5' },
					],
				}}
			/>,
		)

		expect(screen.getByText('розм. 40×10')).toBeTruthy()
		expect(screen.getByText('60×8')).toBeTruthy()
		expect(container.textContent).toContain('×2')
		expect(container.querySelector('.sr-only')?.textContent).toBe('рекорд')
		expect(container.querySelector('[data-icon="trophy"]')).toBeTruthy()
	})

	it('puts the unit after the last bodyweight set', () => {
		const { container } = render(
			<SetLine
				sets={{
					unit: 'повт.',
					segments: [
						{ kind: 'work', text: '8' },
						{ kind: 'work', text: '7' },
					],
				}}
			/>,
		)

		expect(container.textContent).toBe('8·7повт.')
	})

	it('renders nothing without segments', () => {
		const { container } = render(<SetLine sets={{ unit: null, segments: [] }} />)

		expect(container.firstChild).toBeNull()
	})
})
