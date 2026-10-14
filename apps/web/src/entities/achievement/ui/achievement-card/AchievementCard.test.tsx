// @vitest-environment jsdom
import type { AchievementResponse } from '@kus/shared'
import { cleanup, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { type ReactNode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { burst, CELEBRATE, countUp } from '@/shared/lib'

import { AchievementCard } from './AchievementCard'

interface PopProps {
	children: ReactNode
	initial: unknown
	onAnimationComplete?: () => void
}

vi.mock('@/shared/lib/motion/burst', () => ({ burst: vi.fn() }))
vi.mock('@/shared/lib/motion/motion.imperative', async (importOriginal) => {
	const actual = await importOriginal<{ countUp: typeof countUp }>()
	return { ...actual, countUp: vi.fn(actual.countUp) }
})
// jsdom has no animation frames to wait for: the pop ends on mount, `initial` shows if it popped
vi.mock('motion/react', async (importOriginal) => {
	const MotionDiv = ({ children, initial, onAnimationComplete }: PopProps) => {
		useEffect(() => {
			onAnimationComplete?.()
		}, [onAnimationComplete])
		return (
			<div data-testid="pop" data-initial={String(initial)}>
				{children}
			</div>
		)
	}
	return { ...(await importOriginal<object>()), motion: { div: MotionDiv } }
})

let isReduced = false

const create = (type: AchievementResponse['type'], value: number): AchievementResponse => ({
	id: '0199b3a4-0000-7000-8000-000000000031',
	type,
	value,
	achievedAt: '2026-10-12T10:00:00.000Z',
})

const getCountedText = (container: HTMLElement): string | null =>
	container.querySelector('[aria-hidden="true"] > span')?.textContent ?? null

beforeEach(() => {
	isReduced = false
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: isReduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
	)
})

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
	vi.unstubAllGlobals()
})

describe('AchievementCard', () => {
	it('fresh kilograms: pops, counts from n−1 to n and throws the achievement confetti once', () => {
		const onEntered = vi.fn()
		const { container } = render(
			<AchievementCard achievement={create('WEIGHT_KG_LOST', 3)} isFresh onEntered={onEntered} />,
		)

		const call = vi.mocked(countUp).mock.calls[0]
		expect(call?.[1]).toBe(2)
		expect(call?.[2]).toBe(3)
		expect(call?.[3]?.format?.(2)).toBe('Мінус 2 кг від старту')
		expect(call?.[3]?.format?.(3)).toBe('Мінус 3 кг від старту')
		expect(getCountedText(container)).toBe('Мінус 2 кг від старту')
		expect(screen.getByTestId('pop').getAttribute('data-initial')).toBe('hidden')
		expect(container.querySelector('[data-mood]')?.getAttribute('data-mood')).toBe('happy')
		expect(burst).toHaveBeenCalledTimes(1)
		expect(vi.mocked(burst).mock.calls[0]?.[2]).toBe(CELEBRATE.achieve)
		expect(onEntered).toHaveBeenCalled()
	})

	it('fresh streak: counts from n−1 to n with the plural of n', () => {
		const { container } = render(<AchievementCard achievement={create('FOOD_STREAK', 7)} isFresh />)

		const call = vi.mocked(countUp).mock.calls[0]
		expect(call?.[1]).toBe(6)
		expect(call?.[2]).toBe(7)
		expect(getCountedText(container)).toBe('6 днів поспіль із записами')
		expect(screen.getByRole('status').textContent).toContain('7 днів поспіль із записами')
	})

	it('gives a screen reader only the final sentence', () => {
		const { container } = render(<AchievementCard achievement={create('FOOD_STREAK', 3)} isFresh />)

		const hidden = container.querySelector('[aria-hidden="true"] > span')
		expect(hidden?.parentElement?.getAttribute('aria-hidden')).toBe('true')
		expect(container.querySelector('.sr-only')?.textContent).toBe('3 дні поспіль із записами')
		expect(screen.getByRole('status').textContent).toContain('Досягнення')
	})

	it('reduced motion: no pop, no confetti, the final number at once', () => {
		isReduced = true
		const onEntered = vi.fn()
		const { container } = render(
			<AchievementCard achievement={create('WEIGHT_KG_LOST', 3)} isFresh onEntered={onEntered} />,
		)

		expect(getCountedText(container)).toBe('Мінус 3 кг від старту')
		expect(screen.getByTestId('pop').getAttribute('data-initial')).toBe('false')
		expect(burst).not.toHaveBeenCalled()
		expect(onEntered).toHaveBeenCalled()
	})

	it('not fresh (history, reload): static card, the final number, no effects', () => {
		const onEntered = vi.fn()
		const { container } = render(
			<AchievementCard achievement={create('FOOD_STREAK', 14)} onEntered={onEntered} />,
		)

		const call = vi.mocked(countUp).mock.calls[0]
		expect(call?.[1]).toBe(14)
		expect(call?.[2]).toBe(14)
		expect(getCountedText(container)).toBe('14 днів поспіль із записами')
		expect(screen.getByTestId('pop').getAttribute('data-initial')).toBe('false')
		expect(burst).not.toHaveBeenCalled()
		expect(onEntered).not.toHaveBeenCalled()
	})
})

describe('achievement texts', () => {
	it.each([
		[1, '1 день поспіль із записами'],
		[2, '2 дні поспіль із записами'],
		[3, '3 дні поспіль із записами'],
		[7, '7 днів поспіль із записами'],
		[14, '14 днів поспіль із записами'],
		[21, '21 день поспіль із записами'],
		[30, '30 днів поспіль із записами'],
		[60, '60 днів поспіль із записами'],
		[100, '100 днів поспіль із записами'],
	])('streak %i has the right plural form', (count, expected) => {
		expect(i18n.t('achievement.foodStreak', { count, value: count })).toBe(expected)
	})

	it.each([1, 2, 3, 5])('kilograms %i read «Мінус N кг від старту»', (count) => {
		expect(i18n.t('achievement.weightKgLost', { count, value: count })).toBe(
			`Мінус ${count} кг від старту`,
		)
	})
})
