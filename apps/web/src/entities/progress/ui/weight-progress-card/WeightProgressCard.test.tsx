// @vitest-environment jsdom
import type { ProgressWeight } from '@kus/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { WeightProgressCard } from './WeightProgressCard'

afterEach(cleanup)

const TODAY = '2026-09-05'

const createWeight = (points: ProgressWeight['points']): ProgressWeight => ({
	current: { value: 82.4, localDate: points.at(-1)?.localDate ?? TODAY },
	changeInRange: null,
	points,
	target: null,
	toGoal: null,
	isGoalReached: null,
	start: null,
	fromStart: null,
})

describe('WeightProgressCard chart labels', () => {
	it('one weigh-in today: the left label is its date, the right one says «сьогодні»', () => {
		render(
			<WeightProgressCard
				weight={createWeight([{ localDate: TODAY, value: 82.4 }])}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('5 вер')).toBeTruthy()
		expect(screen.getByText('сьогодні')).toBeTruthy()
	})

	it('one weigh-in on an earlier day: its date once, not twice', () => {
		render(
			<WeightProgressCard
				weight={createWeight([{ localDate: '2026-09-02', value: 82.4 }])}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getAllByText('2 вер')).toHaveLength(1)
		expect(screen.queryByText('сьогодні')).toBeNull()
	})

	it('several weigh-ins: the first date on the left, «сьогодні» on the right', () => {
		render(
			<WeightProgressCard
				weight={createWeight([
					{ localDate: '2026-09-01', value: 83.4 },
					{ localDate: TODAY, value: 82.4 },
				])}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('1 вер')).toBeTruthy()
		expect(screen.getByText('сьогодні')).toBeTruthy()
	})
})

describe('WeightProgressCard chart marks', () => {
	it('captions the first and the latest weight and rings the end dot', () => {
		const { container } = render(
			<WeightProgressCard
				weight={createWeight([
					{ localDate: '2026-09-01', value: 84 },
					{ localDate: TODAY, value: 82.4 },
				])}
				range={7}
				today={TODAY}
			/>,
		)

		expect(container.querySelector('[data-sparkline-first]')?.textContent).toBe('84,0')
		expect(container.querySelector('[data-sparkline-last]')?.textContent).toBe('82,4')
		expect(container.querySelector('[data-sparkline-end-dot]')).toBeTruthy()
	})
})

describe('WeightProgressCard start row', () => {
	const points = [
		{ localDate: '2026-08-28', value: 85 },
		{ localDate: TODAY, value: 82.4 },
	]

	it('shows the start with its date and the change from it', () => {
		render(
			<WeightProgressCard
				weight={{
					...createWeight(points),
					start: { value: 85, localDate: '2026-08-28' },
					fromStart: -2.6,
				}}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('85,0 кг')).toBeTruthy()
		expect(screen.getByText(/· 28 серп/)).toBeTruthy()
		const delta = screen.getByText('−2,6 кг')
		expect(delta.className).toContain('text-success-ink')
	})

	it('keeps the success tone for a gain too', () => {
		render(
			<WeightProgressCard
				weight={{
					...createWeight(points),
					start: { value: 70, localDate: '2026-08-28' },
					fromStart: 12.4,
				}}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('+12,4 кг').className).toContain('text-success-ink')
	})

	it('has no row without a start', () => {
		render(<WeightProgressCard weight={createWeight(points)} range={7} today={TODAY} />)

		expect(screen.queryByText('Старт')).toBeNull()
		expect(screen.queryByText(/від старту/)).toBeNull()
	})

	it('start equal to the current weight: only «Старт … · сьогодні»', () => {
		render(
			<WeightProgressCard
				weight={{
					...createWeight([{ localDate: TODAY, value: 82.4 }]),
					start: { value: 82.4, localDate: TODAY },
					fromStart: null,
				}}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getAllByText('82,4 кг').length).toBeGreaterThan(0)
		expect(screen.queryByText(/від старту/)).toBeNull()
		expect(screen.getAllByText(/сьогодні/).length).toBeGreaterThan(1)
	})
})
