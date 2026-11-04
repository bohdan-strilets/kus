// @vitest-environment jsdom
import type { RestNext, RestTimer } from '@/features/live-workout'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createWrapper, renderWithProviders } from '@/shared/testing'

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
		rowKey: 'set-key',
		reps: 8,
		weightKg: 52.5,
		durationSec: null,
		distanceM: null,
		isWarmup: false,
		doneAt: null,
	},
	setNumber: 3,
	isWarmup: false,
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

		expect(screen.getByText('Далі: підхід 3 · 52,5 кг × 8 повт.')).toBeTruthy()
	})

	it('running, another exercise: «Далі: {exercise} · {set}»', () => {
		renderWithProviders(
			<RestTimerPanel timer={makeTimer({ next: next({ isOtherExercise: true, setNumber: 1 }) })} />,
		)

		expect(screen.getByText('Далі: Присідання · 52,5 кг × 8 повт.')).toBeTruthy()
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

		expect(screen.getByText('52,5 кг × 8 повт.')).toBeTruthy()
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

		expect(screen.getByText('Далі: Присідання · 52,5 кг × 8 повт.')).toBeTruthy()
		expect(screen.getByText('Час! Підхід 1')).toBeTruthy()
	})

	it('running with no next: still renders without the next line', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer({ next: null })} />)

		expect(screen.getByText('Відпочинок')).toBeTruthy()
		expect(screen.queryByText(/Далі:/)).toBeNull()
	})
})

describe('RestTimerPanel: warm-up and other set shapes', () => {
	const warmupSet = {
		rowKey: 'set-key',
		reps: 10,
		weightKg: 40,
		durationSec: null,
		distanceM: null,
		isWarmup: true,
		doneAt: null,
	}

	it('running, same exercise: «Далі: розминка · {set}»', () => {
		renderWithProviders(
			<RestTimerPanel timer={makeTimer({ next: next({ isWarmup: true, set: warmupSet }) })} />,
		)

		expect(screen.getByText('Далі: розминка · 40 кг × 10 повт.')).toBeTruthy()
	})

	it('running, another exercise: «Далі: {exercise} · розминка · {set}»', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({
					next: next({
						isWarmup: true,
						isOtherExercise: true,
						set: warmupSet,
						exercise: { ...next().exercise, name: 'Жим гантелей' },
					}),
				})}
			/>,
		)

		expect(screen.getByText('Далі: Жим гантелей · розминка · 40 кг × 10 повт.')).toBeTruthy()
	})

	it('ended, warm-up: «розминка · {set}», title «Час! Розминка», no «Час! Підхід»', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({
					state: { status: 'ended', totalSec: 90, overdueMs: 0 },
					next: next({ isWarmup: true, set: warmupSet }),
				})}
			/>,
		)

		expect(screen.getByText('розминка · 40 кг × 10 повт.')).toBeTruthy()
		expect(screen.getByText('Час! Розминка')).toBeTruthy()
		expect(screen.queryByText(/Час! Підхід/)).toBeNull()
	})

	it('a set without weight: just reps', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({
					next: next({ set: { ...warmupSet, isWarmup: false, weightKg: null, reps: 15 } }),
				})}
			/>,
		)

		expect(screen.getByText('Далі: підхід 3 · 15 повт.')).toBeTruthy()
	})

	it('a timed set: seconds', () => {
		renderWithProviders(
			<RestTimerPanel
				timer={makeTimer({
					next: next({
						set: { ...warmupSet, isWarmup: false, weightKg: null, reps: null, durationSec: 45 },
					}),
				})}
			/>,
		)

		expect(screen.getByText('Далі: підхід 3 · 45 с')).toBeTruthy()
	})
})

describe('RestTimerPanel: the height it takes', () => {
	const PANEL_HEIGHT_PX = 168

	afterEach(() => {
		Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
		vi.unstubAllGlobals()
	})

	const stubLayout = (): void => {
		Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
			configurable: true,
			get: () => PANEL_HEIGHT_PX,
		})
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
	}

	const renderPanel = (onHeightChange: (heightPx: number) => void) => {
		const Wrapper = createWrapper()
		const view = render(
			<Wrapper>
				<RestTimerPanel timer={makeTimer()} onHeightChange={onHeightChange} />
			</Wrapper>,
		)
		return {
			...view,
			rest: () => {
				view.rerender(
					<Wrapper>
						<RestTimerPanel
							timer={makeTimer({ state: { status: 'idle' } })}
							onHeightChange={onHeightChange}
						/>
					</Wrapper>,
				)
			},
		}
	}

	it('reports its height when it appears', () => {
		stubLayout()
		const onHeightChange = vi.fn()

		renderPanel(onHeightChange)

		expect(onHeightChange).toHaveBeenLastCalledWith(PANEL_HEIGHT_PX)
	})

	it('reports 0 once it is gone', async () => {
		stubLayout()
		const onHeightChange = vi.fn()
		const view = renderPanel(onHeightChange)

		view.rest()

		await waitFor(() => {
			expect(onHeightChange).toHaveBeenLastCalledWith(0)
		})
		expect(screen.queryByRole('timer')).toBeNull()
	})

	it('works without onHeightChange', () => {
		renderWithProviders(<RestTimerPanel timer={makeTimer()} />)

		expect(screen.getByRole('timer')).toBeTruthy()
	})
})
