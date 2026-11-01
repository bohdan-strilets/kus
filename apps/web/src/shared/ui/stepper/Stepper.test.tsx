// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Stepper } from './Stepper'

afterEach(cleanup)

const renderStepper = (patch: Partial<Parameters<typeof Stepper>[0]> = {}) => {
	const onDecrease = vi.fn()
	const onIncrease = vi.fn()
	render(
		<Stepper
			label="Підходи"
			valueText="3"
			decreaseLabel="Менше: Підходи"
			increaseLabel="Більше: Підходи"
			onDecrease={onDecrease}
			onIncrease={onIncrease}
			{...patch}
		/>,
	)
	return { onDecrease, onIncrease }
}

describe('Stepper', () => {
	it('is a labelled group with the value and the unit', () => {
		renderStepper({ valueText: '2,5', unit: 'кг' })

		expect(screen.getByRole('group', { name: 'Підходи' }).textContent).toContain('2,5')
		expect(screen.getByText('кг')).toBeTruthy()
	})

	it('calls the handlers of − and +', () => {
		const { onDecrease, onIncrease } = renderStepper()

		fireEvent.click(screen.getByRole('button', { name: 'Менше: Підходи' }))
		fireEvent.click(screen.getByRole('button', { name: 'Більше: Підходи' }))

		expect(onDecrease).toHaveBeenCalledTimes(1)
		expect(onIncrease).toHaveBeenCalledTimes(1)
	})

	it('does not call a disabled button', () => {
		const { onDecrease } = renderStepper({ isDecreaseDisabled: true })

		fireEvent.click(screen.getByRole('button', { name: 'Менше: Підходи' }))

		expect(onDecrease).not.toHaveBeenCalled()
	})
})

describe('Stepper typed value', () => {
	const renderEditable = (patch: { decimals?: number; inputValue?: string } = {}) => {
		const onCommit = vi.fn()
		renderStepper({
			valueText: '2,5',
			edit: {
				min: 0,
				max: 500,
				decimals: patch.decimals ?? 1,
				inputValue: patch.inputValue ?? '2,5',
				buttonLabel: 'Підходи: 2,5, змінити',
				onCommit,
			},
		})
		fireEvent.click(screen.getByRole('button', { name: 'Підходи: 2,5, змінити' }))
		return { onCommit, input: screen.getByRole<HTMLInputElement>('textbox', { name: 'Підходи' }) }
	}

	it('keeps the value plain text without edit', () => {
		renderStepper()

		expect(screen.queryByRole('button', { name: /змінити/ })).toBeNull()
	})

	it('opens an input with the value, focused and selected', () => {
		const { input } = renderEditable()

		expect(input.value).toBe('2,5')
		expect(document.activeElement).toBe(input)
		expect(input.inputMode).toBe('decimal')
	})

	it('uses the numeric keyboard for whole numbers', () => {
		const { input } = renderEditable({ decimals: 0, inputValue: '3' })

		expect(input.inputMode).toBe('numeric')
	})

	it.each(['12,5', '12.5'])('applies %s on Enter', (text) => {
		const { onCommit, input } = renderEditable()

		fireEvent.change(input, { target: { value: text } })
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onCommit).toHaveBeenCalledWith(12.5)
		expect(screen.queryByRole('textbox')).toBeNull()
	})

	it('applies on blur', () => {
		const { onCommit, input } = renderEditable()

		fireEvent.change(input, { target: { value: '40' } })
		fireEvent.blur(input)

		expect(onCommit).toHaveBeenCalledWith(40)
	})

	it('reverts an invalid value', () => {
		const { onCommit, input } = renderEditable()

		fireEvent.change(input, { target: { value: '9999' } })
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(onCommit).not.toHaveBeenCalled()
		expect(screen.getByRole('button', { name: 'Підходи: 2,5, змінити' })).toBeTruthy()
	})

	it('reverts on Escape', () => {
		const { onCommit, input } = renderEditable()

		fireEvent.change(input, { target: { value: '40' } })
		fireEvent.keyDown(input, { key: 'Escape' })

		expect(onCommit).not.toHaveBeenCalled()
		expect(screen.queryByRole('textbox')).toBeNull()
	})
})
