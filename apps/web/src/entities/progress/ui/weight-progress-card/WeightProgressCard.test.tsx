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
