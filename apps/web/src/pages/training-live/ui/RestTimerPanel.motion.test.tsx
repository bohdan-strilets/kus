// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type * as MotionReact from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RestTimer } from '@/features/live-workout'
import { sheetReducedVariants, sheetVariants } from '@/shared/lib'
import { createWrapper } from '@/shared/testing'

const mocks = vi.hoisted(() => ({
	isReduced: false,
	props: [] as Record<string, unknown>[],
}))

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<typeof MotionReact>()
	const mockSection = (
		props: Record<string, unknown> & { children?: ReactNode; className?: string },
	) => {
		mocks.props.push(props)
		return <section className={props.className}>{props.children}</section>
	}
	return {
		...actual,
		useReducedMotion: () => mocks.isReduced,
		motion: new Proxy(actual.motion, {
			get: (target, key) =>
				key === 'section' ? mockSection : (Reflect.get(target, key) as unknown),
		}),
	}
})

const { RestTimerPanel } = await import('./RestTimerPanel')

const HINT = 'Екран може гаснути — тримай Kusik відкритим, щоб почути сигнал.'

const makeTimer = (state: RestTimer['state']): RestTimer => ({
	state,
	next: null,
	extend: vi.fn(),
	skip: vi.fn(),
})

const RUNNING: RestTimer['state'] = { status: 'running', remainingSec: 56, totalSec: 90 }
const ENDED: RestTimer['state'] = { status: 'ended', totalSec: 90, overdueMs: 0 }

const renderPanel = (state: RestTimer['state'], isWakeLockUnavailable?: boolean) => {
	const Wrapper = createWrapper()
	return render(
		<Wrapper>
			<RestTimerPanel timer={makeTimer(state)} isWakeLockUnavailable={isWakeLockUnavailable} />
		</Wrapper>,
	)
}

beforeEach(() => {
	mocks.props = []
	mocks.isReduced = false
})

afterEach(cleanup)

describe('RestTimerPanel: reduced motion', () => {
	it('reduce: the sheet gets sheetReducedVariants', () => {
		mocks.isReduced = true

		renderPanel(RUNNING)

		expect(mocks.props[mocks.props.length - 1]?.variants).toBe(sheetReducedVariants)
	})

	it('no reduce: the sheet gets sheetVariants', () => {
		renderPanel(RUNNING)

		expect(mocks.props[mocks.props.length - 1]?.variants).toBe(sheetVariants)
	})
})

describe('RestTimerPanel: the Wake Lock strip', () => {
	it('running and Wake Lock unavailable: the strip is inside the sheet', () => {
		const { container } = renderPanel(RUNNING, true)

		const strip = screen.getByText(HINT)
		expect(strip.closest('section')).toBe(container.querySelector('section'))
	})

	it('ended: no strip', () => {
		renderPanel(ENDED, true)

		expect(screen.queryByText(HINT)).toBeNull()
	})

	it('idle: no sheet and no strip', () => {
		renderPanel({ status: 'idle' }, true)

		expect(screen.queryByText(HINT)).toBeNull()
	})

	it('Wake Lock available (or the prop omitted): no strip', () => {
		renderPanel(RUNNING, false)
		expect(screen.queryByText(HINT)).toBeNull()

		cleanup()
		renderPanel(RUNNING)
		expect(screen.queryByText(HINT)).toBeNull()
	})
})
