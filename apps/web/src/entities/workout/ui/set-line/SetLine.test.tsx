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
					segments: [
						{ kind: 'warmup', text: '40 кг × 10' },
						{ kind: 'work', text: '60 кг × 8', count: 2 },
						{ kind: 'record', text: '70 кг × 5' },
					],
				}}
			/>,
		)

		expect(screen.getByText('розминка · 40 кг × 10')).toBeTruthy()
		expect(screen.getByText('60 кг × 8')).toBeTruthy()
		expect(screen.getByText('— 2 підходи')).toBeTruthy()
		expect(container.querySelector('.sr-only')?.textContent).toBe('рекорд')
		expect(container.querySelector('[data-icon="trophy"]')).toBeTruthy()
	})

	it('writes bodyweight sets as pills with «повт.»', () => {
		const { container } = render(
			<SetLine
				sets={{
					segments: [
						{ kind: 'work', text: '8 повт.' },
						{ kind: 'work', text: '7 повт.' },
					],
				}}
			/>,
		)

		expect(container.textContent).toBe('8 повт.7 повт.')
	})

	it.each([
		[1, '— 1 підхід'],
		[2, '— 2 підходи'],
		[5, '— 5 підходів'],
	])('writes the repeat of %i sets with the right plural', (count, text) => {
		render(<SetLine sets={{ segments: [{ kind: 'work', text: '70 кг × 5', count }] }} />)

		expect(screen.getByText(text)).toBeTruthy()
	})

	it('renders a time set «45 с — 3 підходи» and cardio «10 хв · 1,2 км»', () => {
		const { container } = render(
			<SetLine
				sets={{
					segments: [
						{ kind: 'work', text: '45 с', count: 3 },
						{ kind: 'work', text: '10 хв · 1,2 км' },
					],
				}}
			/>,
		)

		expect(container.textContent).toBe('45 с— 3 підходи10 хв · 1,2 км')
	})

	it('renders nothing without segments', () => {
		const { container } = render(<SetLine sets={{ segments: [] }} />)

		expect(container.firstChild).toBeNull()
	})
})
