// @vitest-environment jsdom
import type { TrainingGroupKey } from '@kus/shared'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { WorkoutDayDots, type WorkoutDayDotsProps } from './WorkoutDayDots'

const renderDots = (props: Partial<WorkoutDayDotsProps>): HTMLElement => {
	const { container } = render(
		<div>
			<WorkoutDayDots
				groups={[]}
				hasWorkout={false}
				isPlanned={false}
				isOnDark={false}
				{...props}
			/>
		</div>,
	)
	return container.firstElementChild as HTMLElement
}

const FIVE: TrainingGroupKey[] = ['CARDIO', 'CHEST', 'BACK', 'LEGS', 'SHOULDERS']

afterEach(cleanup)

describe('WorkoutDayDots', () => {
	it('draws a dot per group in ink colours', () => {
		const root = renderDots({ groups: ['CHEST', 'LEGS'], hasWorkout: true })

		const dots = [...root.children]
		expect(dots).toHaveLength(2)
		expect(dots[0]?.className).toContain('bg-muscle-chest-ink')
		expect(dots[1]?.className).toContain('bg-muscle-legs-ink')
	})

	it('draws at most three dots, the first three in the given order', () => {
		const root = renderDots({ groups: FIVE, hasWorkout: true })

		expect([...root.children].map((dot) => /bg-muscle-(\w+)-ink/.exec(dot.className)?.[1])).toEqual(
			['cardio', 'chest', 'back'],
		)
	})

	it('uses the light colours of the groups on the dark pill of today', () => {
		const root = renderDots({ groups: ['CHEST'], hasWorkout: true, isOnDark: true })

		expect(root.children[0]?.className).toContain('bg-muscle-chest-bg')
		expect(root.children[0]?.className).not.toContain('bg-muscle-chest-ink')
	})

	it('draws one neutral dot for a training without a group', () => {
		const root = renderDots({ groups: [], hasWorkout: true })

		expect(root.children).toHaveLength(1)
		expect(root.children[0]?.className).toContain('bg-muted-soft')
	})

	it('draws a neutral light dot without a group on the dark pill', () => {
		const root = renderDots({ groups: [], hasWorkout: true, isOnDark: true })

		expect(root.children[0]?.className).toContain('bg-white/60')
	})

	it('draws a ring for a planned day, in the ink colour on a light day', () => {
		const root = renderDots({ isPlanned: true })

		expect(root.children).toHaveLength(1)
		expect(root.children[0]?.className).toContain('border-hint-training-ink')
		expect(root.children[0]?.className).not.toContain('border-hint-training-bg')
		expect(root.children[0]?.getAttribute('aria-hidden')).toBe('true')
	})

	it('draws the ring in the light colour on the pill of today', () => {
		const root = renderDots({ isPlanned: true, isOnDark: true })

		expect(root.children[0]?.className).toContain('border-hint-training-bg')
		expect(root.children[0]?.className).not.toContain('border-hint-training-ink')
	})

	it('prefers the dots to the ring when a training is there', () => {
		const root = renderDots({ groups: ['CHEST'], hasWorkout: true, isPlanned: true })

		expect(root.children).toHaveLength(1)
		expect(root.children[0]?.className).toContain('bg-muscle-chest-ink')
	})

	it('draws nothing for a quiet day', () => {
		expect(renderDots({}).children).toHaveLength(0)
	})

	it('hides every dot from screen readers', () => {
		const root = renderDots({ groups: ['CHEST', 'BACK'], hasWorkout: true })

		for (const dot of root.children) expect(dot.getAttribute('aria-hidden')).toBe('true')
	})
})
