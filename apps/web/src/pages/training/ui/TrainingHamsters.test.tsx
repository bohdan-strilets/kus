// @vitest-environment jsdom
import type { ProgramTemplateResponse } from '@kus/shared'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { NextWorkoutCard } from './NextWorkoutCard'
import { TrainingEmpty } from './TrainingEmpty'

vi.mock('motion', () => ({ animate: vi.fn() }))

const TEMPLATE: ProgramTemplateResponse = {
	id: '0199b3a4-0000-7000-8000-0000000000a0',
	key: 'a',
	name: 'Тренування А',
	position: 0,
	weekdays: [],
	estimatedMin: 55,
	muscleGroups: ['CHEST'],
	hasCardio: false,
	exercises: [],
}

const moodOf = (container: HTMLElement): string | null | undefined =>
	container.querySelector('svg[data-mood]')?.getAttribute('data-mood')

afterEach(cleanup)

describe('hamsters of the training tab', () => {
	it('«Наступне» holds a dumbbell', () => {
		const { container } = renderWithProviders(<NextWorkoutCard template={TEMPLATE} />)

		expect(moodOf(container)).toBe('dumbbell')
	})

	it('the empty journal still warms up', () => {
		const { container } = renderWithProviders(<TrainingEmpty onAction={() => undefined} />)

		expect(moodOf(container)).toBe('warmup')
	})
})
