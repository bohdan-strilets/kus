// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { SetRow } from '../set-row/SetRow'
import { SetTable } from './SetTable'

afterEach(cleanup)

const HEADER_LABELS = ['Підхід', 'Вага', 'Повтори']

describe('SetTable', () => {
	it('shows the aria-hidden header «Підхід · Вага · Повтори» over the rows', () => {
		const { container } = render(
			<SetTable hasWeight>
				<SetRow
					label="1"
					ariaLabel="Підхід 1, змінити"
					reps={8}
					weightKg={60}
					hasWeight
					isWarmup={false}
					isDone={false}
				/>
			</SetTable>,
		)

		const header = container.querySelector('[aria-hidden="true"]')
		expect(header).toBeTruthy()
		expect(HEADER_LABELS.map((label) => header?.textContent.includes(label))).toEqual([
			true,
			true,
			true,
		])
	})

	it('has no «Вага» column for an exercise without weight', () => {
		const { container } = render(
			<SetTable hasWeight={false}>
				<SetRow
					label="1"
					ariaLabel="Підхід 1, змінити"
					reps={12}
					weightKg={null}
					hasWeight={false}
					isWarmup={false}
					isDone={false}
				/>
			</SetTable>,
		)

		const header = container.querySelector('[aria-hidden="true"]')
		expect(header?.textContent).toContain('Підхід')
		expect(header?.textContent).toContain('Повтори')
		expect(header?.textContent).not.toContain('Вага')
		expect(screen.queryByText('кг')).toBeNull()
	})

	it('lists the numbers of the sets and marks a warm-up «розм.»', () => {
		render(
			<SetTable hasWeight>
				<SetRow
					label="розм."
					ariaLabel="Розминка, змінити"
					reps={10}
					weightKg={40}
					hasWeight
					isWarmup
					isDone={false}
				/>
				<SetRow
					label="1"
					ariaLabel="Підхід 1, змінити"
					reps={8}
					weightKg={60}
					hasWeight
					isWarmup={false}
					isDone={false}
				/>
				<SetRow
					label="2"
					ariaLabel="Підхід 2, змінити"
					reps={8}
					weightKg={62.5}
					hasWeight
					isWarmup={false}
					isDone
				/>
			</SetTable>,
		)

		expect(screen.getByText('розм.')).toBeTruthy()
		expect(screen.getByText('1')).toBeTruthy()
		expect(screen.getByText('2')).toBeTruthy()
		expect(screen.getByText('62,5')).toBeTruthy()
	})

	it('makes a selectable row a keyboard-reachable button with its own name', () => {
		const onSelect = vi.fn()
		render(
			<SetTable hasWeight>
				<SetRow
					label="2"
					ariaLabel="Підхід 2, змінити"
					reps={8}
					weightKg={60}
					hasWeight
					isWarmup={false}
					isDone={false}
					onSelect={onSelect}
				/>
			</SetTable>,
		)

		const row = screen.getByRole('button', { name: 'Підхід 2, змінити' })
		row.click()
		expect(onSelect).toHaveBeenCalledTimes(1)
	})

	it('shows a row without onSelect as plain content, not a button', () => {
		render(
			<SetTable hasWeight>
				<SetRow
					label="1"
					ariaLabel="Підхід 1, змінити"
					reps={8}
					weightKg={60}
					hasWeight
					isWarmup={false}
					isDone={false}
				/>
			</SetTable>,
		)

		expect(screen.queryByRole('button')).toBeNull()
	})
})
