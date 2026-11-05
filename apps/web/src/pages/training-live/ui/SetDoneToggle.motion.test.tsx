// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import type * as MotionReact from 'motion/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { popInReducedVariants, popInVariants } from '@/shared/lib'
import { createWrapper } from '@/shared/testing'

const mocks = vi.hoisted(() => ({
	isReduced: false,
	props: [] as Record<string, unknown>[],
}))

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<typeof MotionReact>()
	const mockSpan = (props: Record<string, unknown> & { children?: ReactNode }) => {
		mocks.props.push(props)
		return <span>{props.children}</span>
	}
	return {
		...actual,
		useReducedMotion: () => mocks.isReduced,
		motion: new Proxy(actual.motion, {
			get: (target, key) => (key === 'span' ? mockSpan : (Reflect.get(target, key) as unknown)),
		}),
	}
})

const { SetDoneToggle } = await import('./SetDoneToggle')

const renderToggle = () => {
	const Wrapper = createWrapper()
	return render(
		<Wrapper>
			<SetDoneToggle label="1" isDone onToggle={vi.fn()} />
		</Wrapper>,
	)
}

beforeEach(() => {
	mocks.props = []
	mocks.isReduced = false
})

afterEach(cleanup)

describe('SetDoneToggle: reduced motion', () => {
	it('reduce: the check uses popInReducedVariants', () => {
		mocks.isReduced = true

		renderToggle()

		expect(mocks.props[mocks.props.length - 1]?.variants).toBe(popInReducedVariants)
	})

	it('no reduce: the check uses popInVariants', () => {
		renderToggle()

		expect(mocks.props[mocks.props.length - 1]?.variants).toBe(popInVariants)
	})
})
