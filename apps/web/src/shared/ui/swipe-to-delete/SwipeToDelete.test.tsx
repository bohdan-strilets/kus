// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { SwipeGroup } from './SwipeGroup'
import { SwipeToDelete } from './SwipeToDelete'

const ROW_WIDTH = 300
const POINTER_ID = 1

const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

beforeEach(() => {
	MotionGlobalConfig.skipAnimations = true
	// jsdom has no layout: the row is 300 px wide
	Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
		configurable: true,
		get: () => ROW_WIDTH,
	})
	Element.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
	MotionGlobalConfig.skipAnimations = false
	if (originalOffsetWidth) {
		Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
	}
	cleanup()
})

interface RowProps {
	name: string
	onAction?: (row: HTMLElement | null) => void
	onTap?: () => void
	isDisabled?: boolean
}

const Row = ({ name, onAction = () => undefined, onTap, isDisabled }: RowProps) => (
	<SwipeToDelete
		actionLabel="Видалити"
		actionAriaLabel={`Видалити ${name}`}
		isDisabled={isDisabled}
		onAction={onAction}
	>
		<button type="button" onClick={onTap}>
			{name}
		</button>
	</SwipeToDelete>
)

const getContent = (name: string): HTMLElement =>
	screen.getByText(name).closest('[data-swipe-content]') as HTMLElement

const isActionInert = (name: string): boolean =>
	screen.getByRole('button', { name: `Видалити ${name}`, hidden: true }).closest('[inert]') !== null

const pointer = (x: number, y: number) => ({
	clientX: x,
	clientY: y,
	pointerId: POINTER_ID,
	pointerType: 'touch',
})

/** One finger: down at (200, 100), moves by (dx, dy), up. */
const drag = (name: string, dx: number, dy = 0): void => {
	const content = getContent(name)
	fireEvent.pointerDown(content, pointer(200, 100))
	act(() => {
		fireEvent.pointerMove(content, pointer(200 + dx, 100 + dy))
	})
	fireEvent.pointerUp(content, pointer(200 + dx, 100 + dy))
}

describe('SwipeToDelete: the closed state', () => {
	it('the action is inert until the row is open', () => {
		render(<Row name="Підхід 1" />)

		expect(isActionInert('Підхід 1')).toBe(true)
	})

	it('a tap on the content reaches the child', () => {
		const onTap = vi.fn()
		render(<Row name="Підхід 1" onTap={onTap} />)

		fireEvent.click(screen.getByText('Підхід 1'))

		expect(onTap).toHaveBeenCalledTimes(1)
	})
})

describe('SwipeToDelete: gestures', () => {
	it('a vertical move does not open the row nor run the action', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)

		drag('Підхід 1', 4, -80)

		expect(isActionInert('Підхід 1')).toBe(true)
		expect(onAction).not.toHaveBeenCalled()
	})

	it('a diagonal move that is not 1,5 times wider than tall does not open it', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)

		drag('Підхід 1', -90, 70)

		expect(isActionInert('Підхід 1')).toBe(true)
		expect(onAction).not.toHaveBeenCalled()
	})

	it('a short pull (under 72 px) goes back', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)

		drag('Підхід 1', -50)

		expect(isActionInert('Підхід 1')).toBe(true)
		expect(onAction).not.toHaveBeenCalled()
	})

	it('a pull to the right never opens it', () => {
		render(<Row name="Підхід 1" />)

		drag('Підхід 1', 120)

		expect(isActionInert('Підхід 1')).toBe(true)
	})

	it('a pull of 72 px … 50 % opens the action and runs nothing', async () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)

		drag('Підхід 1', -100)

		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(false)
		})
		expect(onAction).not.toHaveBeenCalled()
	})

	it('a pull past 50 % runs the action at once, with the row', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)

		drag('Підхід 1', -200)

		expect(onAction).toHaveBeenCalledTimes(1)
		const row = onAction.mock.calls[0]?.[0] as HTMLElement
		expect(row.hasAttribute('data-swipe-row')).toBe(true)
		expect(isActionInert('Підхід 1')).toBe(true)
	})

	it('the click that ends a swipe is not a tap on the child', () => {
		const onTap = vi.fn()
		render(<Row name="Підхід 1" onTap={onTap} />)

		drag('Підхід 1', -100)
		fireEvent.click(screen.getByText('Підхід 1'))

		expect(onTap).not.toHaveBeenCalled()
	})

	it('a disabled row ignores the swipe', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} isDisabled />)

		drag('Підхід 1', -200)

		expect(onAction).not.toHaveBeenCalled()
		expect(isActionInert('Підхід 1')).toBe(true)
	})

	it('another pointer id is ignored while one finger is down', () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)
		const content = getContent('Підхід 1')

		fireEvent.pointerDown(content, pointer(200, 100))
		fireEvent.pointerMove(content, { ...pointer(0, 100), pointerId: 2 })
		fireEvent.pointerUp(content, { ...pointer(0, 100), pointerId: 2 })

		expect(onAction).not.toHaveBeenCalled()
	})
})

describe('SwipeToDelete: the open action', () => {
	it('the button runs onAction once with the row', async () => {
		const onAction = vi.fn()
		render(<Row name="Підхід 1" onAction={onAction} />)
		drag('Підхід 1', -100)
		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(false)
		})

		fireEvent.click(screen.getByRole('button', { name: 'Видалити Підхід 1' }))

		expect(onAction).toHaveBeenCalledTimes(1)
		expect((onAction.mock.calls[0]?.[0] as HTMLElement).hasAttribute('data-swipe-row')).toBe(true)
	})

	it('a tap on the open row only closes it', async () => {
		const onTap = vi.fn()
		render(<Row name="Підхід 1" onTap={onTap} />)
		drag('Підхід 1', -100)
		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(false)
		})
		// the click that ended the swipe
		fireEvent.click(screen.getByText('Підхід 1'))

		fireEvent.click(screen.getByText('Підхід 1'))

		expect(onTap).not.toHaveBeenCalled()
		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(true)
		})
	})

	it('a press anywhere outside closes it', async () => {
		render(<Row name="Підхід 1" />)
		drag('Підхід 1', -100)
		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(false)
		})

		fireEvent.pointerDown(document.body)

		await waitFor(() => {
			expect(isActionInert('Підхід 1')).toBe(true)
		})
	})
})

describe('SwipeGroup', () => {
	it('opening a second row closes the first one', async () => {
		render(
			<SwipeGroup>
				<Row name="Один" />
				<Row name="Два" />
			</SwipeGroup>,
		)

		drag('Один', -100)
		await waitFor(() => {
			expect(isActionInert('Один')).toBe(false)
		})
		drag('Два', -100)

		await waitFor(() => {
			expect(isActionInert('Два')).toBe(false)
		})
		expect(isActionInert('Один')).toBe(true)
	})

	it('a row running its action leaves the others closed', async () => {
		const onAction = vi.fn()
		render(
			<SwipeGroup>
				<Row name="Один" />
				<Row name="Два" onAction={onAction} />
			</SwipeGroup>,
		)
		drag('Один', -100)
		await waitFor(() => {
			expect(isActionInert('Один')).toBe(false)
		})

		drag('Два', -200)

		expect(onAction).toHaveBeenCalledTimes(1)
		await waitFor(() => {
			expect(isActionInert('Один')).toBe(true)
		})
	})

	it('without a group each row keeps its own state', async () => {
		render(
			<>
				<Row name="Один" />
				<Row name="Два" />
			</>,
		)

		drag('Один', -100)
		await waitFor(() => {
			expect(isActionInert('Один')).toBe(false)
		})
		drag('Два', -100)

		await waitFor(() => {
			expect(isActionInert('Два')).toBe(false)
		})
		// a press on the second row is "outside" the first one: it closes anyway
		await waitFor(() => {
			expect(isActionInert('Один')).toBe(true)
		})
	})
})
