// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import type * as MotionReact from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { liveRowReducedVariants, liveRowVariants } from '@/shared/lib'

const mocks = vi.hoisted(() => ({
	isReduced: false,
	props: [] as Record<string, unknown>[],
}))

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<typeof MotionReact>()
	return {
		...actual,
		useReducedMotion: () => mocks.isReduced,
		motion: {
			div: (props: Record<string, unknown> & { children?: ReactNode }) => {
				mocks.props.push(props)
				return <div>{props.children}</div>
			},
		},
	}
})

const { RowMotion } = await import('./RowMotion')

const lastProps = (): Record<string, unknown> => mocks.props[mocks.props.length - 1] ?? {}

beforeEach(() => {
	mocks.props = []
	mocks.isReduced = false
})

afterEach(cleanup)

describe('RowMotion', () => {
	it('reduced motion: the reduced variants (opacity only) and no layout', () => {
		mocks.isReduced = true

		render(<RowMotion isEntering>x</RowMotion>)

		expect(lastProps().variants).toBe(liveRowReducedVariants)
		expect(lastProps().layout).toBe(false)
		expect(liveRowReducedVariants.hidden).not.toHaveProperty('height')
		expect(liveRowReducedVariants.gone).not.toHaveProperty('x')
	})

	it('normal motion: full variants and the layout of position', () => {
		render(<RowMotion isEntering>x</RowMotion>)

		expect(lastProps().variants).toBe(liveRowVariants)
		expect(lastProps().layout).toBe('position')
	})

	it('a row that was there from the start does not animate in; one that came later does', () => {
		render(<RowMotion isEntering={false}>a</RowMotion>)
		expect(lastProps().initial).toBe(false)

		render(<RowMotion isEntering>b</RowMotion>)
		expect(lastProps().initial).toBe('hidden')
	})

	it('exit is on by default and off with hasExit=false', () => {
		render(<RowMotion isEntering={false}>a</RowMotion>)
		expect(lastProps().exit).toBe('gone')

		render(
			<RowMotion isEntering={false} hasExit={false}>
				b
			</RowMotion>,
		)
		expect(lastProps().exit).toBeUndefined()
	})
})
