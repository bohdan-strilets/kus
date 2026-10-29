// @vitest-environment jsdom
// motion.div is a plain div: jsdom runs no animation frames, so a real exit animation would never
// finish and the sheet would stay in the DOM. Radix FocusScope's unmount autofocus (setTimeout 0)
// runs for real, so the tests wait for it with waitFor.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, type Ref, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BaseBottomSheet } from './BaseBottomSheet'

interface MotionDivProps {
	children?: ReactNode
	className?: string
	ref?: Ref<HTMLDivElement>
}

vi.mock('motion/react', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	const MotionDiv = ({ children, className, ref, ...rest }: MotionDivProps) => {
		const domProps = Object.fromEntries(
			Object.entries(rest).filter(
				([key]) =>
					key.startsWith('aria-') ||
					key === 'role' ||
					key === 'id' ||
					key === 'tabIndex' ||
					key.startsWith('data-') ||
					(key.startsWith('on') && !key.includes('Drag')),
			),
		)
		return (
			<div ref={ref} className={className} {...domProps}>
				{children}
			</div>
		)
	}
	const actualMotion = actual.motion as Record<string, unknown>
	const motion = new Proxy(actualMotion, {
		get: (target, key: string) => (key === 'div' ? MotionDiv : target[key]),
	})
	return { ...actual, motion }
})

afterEach(cleanup)

interface HarnessProps {
	initialFocus?: 'container' | 'first-field'
}

const Harness = ({ initialFocus }: HarnessProps) => {
	const [isOpen, setIsOpen] = useState<boolean>(false)
	const [hasSecond, setHasSecond] = useState<boolean>(true)
	return (
		<>
			<button
				onClick={() => {
					setIsOpen(true)
				}}
			>
				first
			</button>
			{hasSecond && (
				<button
					onClick={() => {
						setIsOpen(true)
					}}
				>
					second
				</button>
			)}
			<button
				onClick={() => {
					setHasSecond(false)
				}}
			>
				remove-second
			</button>
			<button
				onClick={() => {
					setIsOpen(false)
				}}
			>
				close-outside
			</button>
			<BaseBottomSheet
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				title="Sheet"
				initialFocus={initialFocus}
			>
				<input aria-label="field" />
			</BaseBottomSheet>
		</>
	)
}

const getButton = (name: string): HTMLElement => screen.getByRole('button', { name, hidden: true })

const openFrom = async (trigger: HTMLElement) => {
	trigger.focus()
	trigger.click()
	await screen.findByRole('dialog')
}

const closeWithButton = async () => {
	// Radix sets pointer-events: none on body while a modal is open, so a native click
	act(() => {
		screen.getByRole('button', { name: 'common.close' }).click()
	})
	await waitFor(() => {
		expect(screen.queryByRole('dialog')).toBeNull()
	})
}

describe('BaseBottomSheet focus return', () => {
	it('returns focus to the trigger that was focused on open', async () => {
		render(<Harness />)
		const trigger = getButton('first')
		await openFrom(trigger)
		expect(document.activeElement).not.toBe(trigger)

		await closeWithButton()

		await waitFor(() => {
			expect(document.activeElement).toBe(trigger)
		})
	})

	it('does not throw when the trigger left the DOM before closing', async () => {
		render(<Harness />)
		const second = getButton('second')
		await openFrom(second)
		act(() => {
			getButton('remove-second').click()
		})
		expect(second.isConnected).toBe(false)
		const focusSpy = vi.spyOn(second, 'focus')

		await closeWithButton()

		await new Promise((resolve) => setTimeout(resolve, 20))
		expect(focusSpy).not.toHaveBeenCalled()
		expect(document.activeElement).not.toBe(second)
	})

	it('forces nothing when nothing was focused on open', async () => {
		render(<Harness />)
		expect(document.activeElement).toBe(document.body)
		const bodyFocus = vi.spyOn(document.body, 'focus')
		getButton('first').click()
		await screen.findByRole('dialog')

		await closeWithButton()

		await new Promise((resolve) => setTimeout(resolve, 20))
		expect(bodyFocus).not.toHaveBeenCalled()
		expect(document.activeElement).not.toBeNull()
	})

	it('returns focus to the NEW trigger on the next open (no stale ref)', async () => {
		render(<Harness />)
		const first = getButton('first')
		const second = getButton('second')

		await openFrom(first)
		await closeWithButton()
		await waitFor(() => {
			expect(document.activeElement).toBe(first)
		})

		await openFrom(second)
		await closeWithButton()
		await waitFor(() => {
			expect(document.activeElement).toBe(second)
		})
	})

	it('returns focus to the trigger after closing with Escape', async () => {
		render(<Harness />)
		const trigger = getButton('first')
		await openFrom(trigger)

		await userEvent.keyboard('{Escape}')
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull()
		})

		await waitFor(() => {
			expect(document.activeElement).toBe(trigger)
		})
	})
})

describe('BaseBottomSheet initial focus', () => {
	it('focuses the sheet container by default', async () => {
		render(<Harness />)
		await openFrom(getButton('first'))
		await waitFor(() => {
			expect(document.activeElement).toBe(screen.getByRole('dialog'))
		})
	})

	it('focuses the first field with initialFocus="first-field"', async () => {
		render(<Harness initialFocus="first-field" />)
		await openFrom(getButton('first'))
		await waitFor(() => {
			expect(document.activeElement).toBe(screen.getByLabelText('field'))
		})
	})
})

describe('BaseBottomSheet description layout', () => {
	const renderSheet = (isDescriptionFullWidth: boolean) =>
		render(
			<BaseBottomSheet
				isOpen
				onOpenChange={() => undefined}
				title="Title"
				description="Explanation"
				isDescriptionFullWidth={isDescriptionFullWidth}
			>
				<span>body</span>
			</BaseBottomSheet>,
		)

	const getTitleRow = (): HTMLElement => {
		const row = screen.getByText('Title').parentElement?.parentElement
		if (!row) throw new Error('title row not found')
		return row
	}

	it('full width: title and close share a row, the description is its own block under it', () => {
		renderSheet(true)
		const row = getTitleRow()
		const close = screen.getByRole('button', { name: 'common.close' })
		const description = screen.getByText('Explanation')

		expect(row.contains(close)).toBe(true)
		expect(row.contains(description)).toBe(false)
		expect(row.nextElementSibling).toBe(description)
	})

	it('by default the description stays in the title column', () => {
		renderSheet(false)

		expect(getTitleRow().contains(screen.getByText('Explanation'))).toBe(true)
	})
})
