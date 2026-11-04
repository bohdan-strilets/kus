// @vitest-environment jsdom
import type { RestNext, RestTimer } from '@/features/live-workout'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { RestTimerPanel } from './RestTimerPanel'

const next = (overrides: Partial<RestNext> = {}): RestNext => ({
	exercise: {
		rowKey: 'squat',
		clientKey: 'squat',
		readOnly: false,
		exerciseId: null,
		templateExerciseId: null,
		name: 'Присідання',
		kind: 'STRENGTH',
		muscleGroup: 'LEGS',
		isBodyweight: null,
		durationMin: null,
		distanceM: null,
		sets: [],
		plan: null,
	},
	set: {
		reps: 8,
		weightKg: 52.5,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt: null,
	},
	setNumber: 3,
	isOtherExercise: false,
	...overrides,
})

const makeTimer = (overrides: Partial<RestTimer> = {}): RestTimer => ({
	state: { status: 'running', remainingSec: 56, totalSec: 90 },
	next: next(),
	extend: vi.fn(),
	skip: vi.fn(),
	...overrides,
})

afterEach(() => {
	cleanup()
})

describe('RestTimerPanel', () => {
	it('idle: renders nothing', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer({ state: { status: 'idle' } })} />)

		expect(screen.queryByRole('timer')).toBeNull()
		expect(screen.queryByText('Відпочинок')).toBeNull()
	})

	it('running: a timer with the left time in aria and the title', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer()} />)

		expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Відпочинок, лишилось 0:56')
		expect(screen.getByText('Відпочинок')).toBeTruthy()
		expect(screen.getByText('0:56')).toBeTruthy()
	})

	it('running, same exercise: «Далі: підхід N · вага × повтори»', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer()} />)

		expect(screen.getByText('Далі: підхід 3 · 52,5 кг × 8')).toBeTruthy()
	})

	it('running, another exercise: «Далі: {exercise} · {set}»', () => {
		renderWithProviders(
			<RestTimerPanel timer={makeTimer({ next: next({ isOtherExercise: true, setNumber: 1 }) })} />,
		)

		expect(screen.getByText('Далі: Присідання · 52,5 кг × 8')).toBeTruthy()
	})

	it('the +15 and skip buttons have full aria names and call the timer', () => {
		const timer = makeTimer()
		renderWithProviders(<RestTimerPanel timer={timer} />)

		fireEvent.click(screen.getByRole('button', { name: 'Додати 15 секунд до відпочинку' }))
		fireEvent.click(screen.getByRole('button', { name: 'Пропустити відпочинок' }))

		expect(timer.extend).toHaveBeenCalledTimes(1)
		expect(timer.skip).toHaveBeenCalledTimes(1)
	})

	it('ended: «Час! Підхід N», 0:00, assertive live region, one «До підходу» button', () => {
		const timer = makeTimer({ state: { status: 'ended', totalSec: 90, overdueMs: 0 } })
		renderWithProviders(<RestTimerPanel timer={timer} />)

		const heading = screen.getByText('Час! Підхід 3')
		expect(heading.closest('[aria-live="assertive"]')).not.toBeNull()
		expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Відпочинок, лишилось 0:00')
		expect(screen.queryByRole('button', { name: 'Додати 15 секунд до відпочинку' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Пропустити відпочинок' })).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'До підходу' }))

		expect(timer.skip).toHaveBeenCalledTimes(1)
	})

	it('ended, same exercise: the next set is shown as the bare set text', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({ state: { status: 'ended', totalSec: 90, overdueMs: 5 } })}
			/>,
		)

		expect(screen.getByText('52,5 кг × 8')).toBeTruthy()
	})

	it('ended, another exercise: still «Далі: {exercise} · {set}»', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({
					state: { status: 'ended', totalSec: 90, overdueMs: 0 },
					next: next({ isOtherExercise: true, setNumber: 1 }),
				})}
			/>,
		)

		expect(screen.getByText('Далі: Присідання · 52,5 кг × 8')).toBeTruthy()
		expect(screen.getByText('Час! Підхід 1')).toBeTruthy()
	})

	it('running with no next: still renders without the next line', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer({ next: null })} />)

		expect(screen.getByText('Відпочинок')).toBeTruthy()
		expect(screen.queryByText(/Далі:/)).toBeNull()
	})
})
