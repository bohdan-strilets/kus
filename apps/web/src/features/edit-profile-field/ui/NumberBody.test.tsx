// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { FIELD_DEFINITIONS } from '../model/field-definitions'
import { NumberBody } from './NumberBody'

afterEach(cleanup)

const WAIST_HINT = 'Зранку, на видиху, зазвичай трохи вище пупка.'
const WEIGHT_HINT = 'Зранку, до їжі, на тих самих вагах.'

const renderBody = (field: 'waistCm' | 'heightCm') => {
	const definition = FIELD_DEFINITIONS[field]
	if (definition.kind !== 'number') throw new Error('not a number field')
	renderWithProviders(
		<NumberBody field={field} definition={definition} initialValue="" onSaved={() => undefined} />,
	)
}

describe('NumberBody hint', () => {
	it('shows the waist hint under the field', () => {
		renderBody('waistCm')

		expect(screen.getByText(WAIST_HINT)).toBeTruthy()
	})

	it('shows no hint for a field without one', () => {
		renderBody('heightCm')

		expect(screen.queryByText(WAIST_HINT)).toBeNull()
		expect(screen.queryByText(WEIGHT_HINT)).toBeNull()
	})
})

describe('NumberBody decimals', () => {
	it.each([
		['waistCm', '85,55', '85,5'],
		['waistCm', '85.55', '85.5'],
	] as const)('keeps %s to one decimal: «%s» becomes «%s»', async (field, typed, expected) => {
		renderBody(field)
		const input = screen.getByRole<HTMLInputElement>('textbox')

		await userEvent.type(input, typed)

		expect(input.value).toBe(expected)
	})

	it('does not cut an integer field', async () => {
		renderBody('heightCm')
		const input = screen.getByRole<HTMLInputElement>('textbox')

		await userEvent.type(input, '175')

		expect(input.value).toBe('175')
	})
})
