// @vitest-environment jsdom
import { MAX_SET_WEIGHT_KG } from '@kus/shared'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { SetFields, type SetFieldsProps } from './SetFields'

afterEach(cleanup)

const renderFields = (patch: Partial<SetFieldsProps> = {}) => {
	const onChange = vi.fn()
	renderWithProviders(
		<SetFields
			title="Підхід 2"
			reps={8}
			weightKg={50}
			isBodyweight={false}
			weightStepKg={2.5}
			onChange={onChange}
			{...patch}
		/>,
	)
	return onChange
}

const isDisabled = (name: string): boolean =>
	screen.getByRole<HTMLButtonElement>('button', { name }).disabled

describe('SetFields', () => {
	it('steps the weight by the plan step and the reps by one', () => {
		const onChange = renderFields()

		fireEvent.click(screen.getByRole('button', { name: 'Більше ваги' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше ваги' }))
		fireEvent.click(screen.getByRole('button', { name: 'Більше повторів' }))
		fireEvent.click(screen.getByRole('button', { name: 'Менше повторів' }))

		expect(onChange.mock.calls).toEqual([
			[{ weightKg: 52.5 }],
			[{ weightKg: 47.5 }],
			[{ reps: 9 }],
			[{ reps: 7 }],
		])
	})

	it('shows «—» for empty values and starts the first step from zero', () => {
		const onChange = renderFields({ reps: null, weightKg: null })

		expect(screen.getAllByText('—')).toHaveLength(2)
		fireEvent.click(screen.getByRole('button', { name: 'Більше ваги' }))
		fireEvent.click(screen.getByRole('button', { name: 'Більше повторів' }))

		expect(onChange.mock.calls).toEqual([[{ weightKg: 2.5 }], [{ reps: 1 }]])
	})

	it('disables «less» at the lower bounds and for empty values', () => {
		renderFields({ weightKg: 0, reps: 1 })

		expect(isDisabled('Менше ваги')).toBe(true)
		expect(isDisabled('Менше повторів')).toBe(true)
		cleanup()

		renderFields({ weightKg: null, reps: null })
		expect(isDisabled('Менше ваги')).toBe(true)
		expect(isDisabled('Менше повторів')).toBe(true)
	})

	it('does not step the weight over the limit', () => {
		const onChange = renderFields({ weightKg: MAX_SET_WEIGHT_KG })

		fireEvent.click(screen.getByRole('button', { name: 'Більше ваги' }))

		expect(onChange).toHaveBeenCalledWith({ weightKg: MAX_SET_WEIGHT_KG })
	})

	it('has no weight stepper for a bodyweight exercise', () => {
		renderFields({ isBodyweight: true, weightKg: null })

		expect(screen.queryByRole('button', { name: 'Більше ваги' })).toBeNull()
		expect(screen.getByRole('button', { name: 'Більше повторів' })).toBeTruthy()
	})

	it('commits a typed weight', () => {
		const onChange = renderFields()

		fireEvent.click(screen.getByRole('button', { name: 'кг: ввести число' }))
		const input = screen.getByRole('textbox', { name: 'кг: ввести число' })
		fireEvent.change(input, { target: { value: '77,5' } })
		fireEvent.keyDown(input, { key: 'Enter' })

		expect(onChange).toHaveBeenCalledWith({ weightKg: 77.5 })
	})

	it('renders the title and the children (the «done» control)', () => {
		renderFields({ children: <button type="button">Готово</button> })

		expect(screen.getByText('Підхід 2')).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Готово' })).toBeTruthy()
	})
})
