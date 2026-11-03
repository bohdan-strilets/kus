// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SetStepper } from './SetStepper'
import type { SetStepperProps } from './set-stepper.types'

afterEach(cleanup)

const renderStepper = (patch: Partial<SetStepperProps> = {}) => {
	const handlers = { onDecrease: vi.fn(), onIncrease: vi.fn(), onCommit: vi.fn() }
	render(
		<SetStepper
			value={52.5}
			valueText="52,5"
			unit="кг"
			placeholder="Вага, кг"
			min={0}
			max={500}
			decimals={1}
			decreaseLabel="Менше ваги"
			increaseLabel="Більше ваги"
			editLabel="кг: ввести число"
			{...handlers}
			{...patch}
		/>,
	)
	return handlers
}

const openInput = (): HTMLInputElement => {
	fireEvent.click(screen.getByRole('button', { name: 'кг: ввести число' }))
	return screen.getByRole<HTMLInputElement>('textbox', { name: 'кг: ввести число' })
}

const typeAndEnter = (text: string): void => {
	const input = openInput()
	fireEvent.change(input, { target: { value: text } })
	fireEvent.keyDown(input, { key: 'Enter' })
}

describe('SetStepper', () => {
	it('shows the value and the unit', () => {
		renderStepper()

		expect(screen.getByRole('button', { name: 'кг: ввести число' }).textContent).toBe('52,5')
		expect(screen.getByText('кг')).toBeTruthy()
	})

	it('shows «—» as given for an empty value', () => {
		renderStepper({ value: null, valueText: '—' })

		expect(screen.getByRole('button', { name: 'кг: ввести число' }).textContent).toBe('—')
	})

	it('calls the handlers of − and +', () => {
		const { onDecrease, onIncrease } = renderStepper()

		fireEvent.click(screen.getByRole('button', { name: 'Менше ваги' }))
		fireEvent.click(screen.getByRole('button', { name: 'Більше ваги' }))

		expect(onDecrease).toHaveBeenCalledTimes(1)
		expect(onIncrease).toHaveBeenCalledTimes(1)
	})

	it('does not call a disabled −', () => {
		const { onDecrease } = renderStepper({ isDecreaseDisabled: true })

		fireEvent.click(screen.getByRole('button', { name: 'Менше ваги' }))

		expect(onDecrease).not.toHaveBeenCalled()
	})

	it('opens a native input with the current value, the numeric keyboard hint and the placeholder', () => {
		renderStepper()

		const input = openInput()

		expect(input.value).toBe('52,5')
		expect(input.getAttribute('inputmode')).toBe('decimal')
		expect(input.placeholder).toBe('Вага, кг')
	})

	it('uses the integer keyboard for whole numbers', () => {
		renderStepper({ value: 10, decimals: 0, valueText: '10' })

		const input = openInput()

		expect(input.value).toBe('10')
		expect(input.getAttribute('inputmode')).toBe('numeric')
	})

	it('opens empty (placeholder visible) when there is no value', () => {
		renderStepper({ value: null, valueText: '—' })

		expect(openInput().value).toBe('')
	})

	it('commits a typed number on Enter, once, and closes the input', () => {
		const { onCommit } = renderStepper()
		const input = openInput()

		fireEvent.change(input, { target: { value: '60,5' } })
		fireEvent.keyDown(input, { key: 'Enter' })
		fireEvent.blur(input)

		expect(onCommit).toHaveBeenCalledTimes(1)
		expect(onCommit).toHaveBeenCalledWith(60.5)
		expect(screen.queryByRole('textbox')).toBeNull()
	})

	it('commits on blur', () => {
		const { onCommit } = renderStepper()
		const input = openInput()

		fireEvent.change(input, { target: { value: '70' } })
		fireEvent.blur(input)

		expect(onCommit).toHaveBeenCalledWith(70)
	})

	it('cancels on Escape: nothing is committed, even by the blur that follows', () => {
		const { onCommit } = renderStepper()
		const input = openInput()

		fireEvent.change(input, { target: { value: '70' } })
		fireEvent.keyDown(input, { key: 'Escape' })
		fireEvent.blur(input)

		expect(onCommit).not.toHaveBeenCalled()
		expect(screen.queryByRole('textbox')).toBeNull()
	})

	it.each([['501'], ['abc'], ['1,55'], ['-3'], ['']])(
		'reverts a bad value «%s» without committing',
		(text) => {
			const { onCommit } = renderStepper()

			typeAndEnter(text)

			expect(onCommit).not.toHaveBeenCalled()
			expect(screen.queryByRole('textbox')).toBeNull()
		},
	)

	it('accepts the bounds themselves', () => {
		const { onCommit } = renderStepper()

		typeAndEnter('500')
		expect(onCommit).toHaveBeenLastCalledWith(500)

		typeAndEnter('0')
		expect(onCommit).toHaveBeenLastCalledWith(0)
	})

	it('can be edited again after a commit', () => {
		const { onCommit } = renderStepper()

		typeAndEnter('60')
		typeAndEnter('65')

		expect(onCommit).toHaveBeenCalledTimes(2)
		expect(onCommit).toHaveBeenLastCalledWith(65)
	})
})
