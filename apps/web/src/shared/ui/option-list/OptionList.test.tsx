// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Switch } from '../switch'
import { OptionList } from './OptionList'

afterEach(cleanup)

const OPTIONS = [
	{ value: 'male', label: 'Чоловік' },
	{ value: 'female', label: 'Жінка', hint: 'підказка' },
] as const

describe('OptionList', () => {
	it('marks the chosen option and reports a new choice', async () => {
		const onChange = vi.fn()
		render(<OptionList value="male" onChange={onChange} options={[...OPTIONS]} label="Стать" />)

		expect(screen.getByRole('radiogroup', { name: 'Стать' })).toBeTruthy()
		expect(screen.getByRole('radio', { name: 'Чоловік' }).getAttribute('aria-checked')).toBe('true')

		await userEvent.click(screen.getByRole('radio', { name: /Жінка/ }))
		expect(onChange).toHaveBeenCalledWith('female')
	})

	it('has nothing chosen when value is null', () => {
		render(<OptionList value={null} onChange={vi.fn()} options={[...OPTIONS]} label="Стать" />)
		const checked = screen
			.getAllByRole('radio')
			.filter((r) => r.getAttribute('aria-checked') === 'true')
		expect(checked).toHaveLength(0)
	})
})

describe('Switch', () => {
	it('exposes its state and toggles', async () => {
		const onCheckedChange = vi.fn()
		render(<Switch isChecked={false} onCheckedChange={onCheckedChange} label="Звуки" />)

		const toggle = screen.getByRole('switch', { name: 'Звуки' })
		expect(toggle.getAttribute('aria-checked')).toBe('false')
		expect(toggle.querySelector('[data-state="unchecked"]')).toBeTruthy()

		await userEvent.click(toggle)
		expect(onCheckedChange).toHaveBeenCalledWith(true)
	})
})
