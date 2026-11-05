// @vitest-environment jsdom
import type { WorkoutStatsGroup } from '@kus/shared'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderWithProviders } from '@/shared/testing'

import { GroupsCard } from './GroupsCard'

afterEach(cleanup)

const group = (
	muscleGroup: WorkoutStatsGroup['muscleGroup'],
	setCount: number,
): WorkoutStatsGroup => ({ muscleGroup, setCount })

const getRows = (container: HTMLElement): HTMLElement[] =>
	Array.from(container.querySelectorAll('li'))

const getRow = (rows: HTMLElement[], index: number): HTMLElement => {
	const row = rows[index]
	if (!row) throw new Error(`no row ${String(index)}`)
	return row
}

const getFill = (row: HTMLElement): HTMLElement | null =>
	row.querySelector('[aria-hidden="true"]')?.firstElementChild as HTMLElement | null

describe('GroupsCard', () => {
	it('scales bars to the biggest group, with group colour, name and number as text', () => {
		const { container } = renderWithProviders(
			<GroupsCard groups={[group('CHEST', 20), group('LEGS', 10), group(null, 5)]} cardioMin={0} />,
		)
		const rows = getRows(container)
		const chest = getRow(rows, 0)
		const legs = getRow(rows, 1)
		const other = getRow(rows, 2)

		expect(getFill(chest)?.style.width).toBe('100%')
		expect(getFill(chest)?.classList.contains('bg-muscle-chest-ink')).toBe(true)
		expect(getFill(legs)?.style.width).toBe('50%')
		expect(getFill(legs)?.classList.contains('bg-muscle-legs-ink')).toBe(true)
		expect(getFill(other)?.style.width).toBe('25%')
		expect(getFill(other)?.classList.contains('bg-muted-soft')).toBe(true)

		expect(chest.textContent).toContain('20')
		expect(legs.textContent).toContain('10')
		expect(other.textContent).toContain('5')
		expect(chest.textContent.trim().length).toBeGreaterThan('20'.length)
		for (const row of [chest, legs, other]) {
			expect(row.querySelector('[aria-hidden="true"]')).not.toBeNull()
		}
	})

	it('puts «Інше» last and draws no bar for the cardio row', () => {
		const { container } = renderWithProviders(
			<GroupsCard groups={[group(null, 4), group('BACK', 8)]} cardioMin={30} />,
		)
		const rows = getRows(container)

		expect(rows).toHaveLength(3)
		expect(getRow(rows, 0).querySelector('[aria-hidden="true"]')).toBeNull()
		expect(getFill(getRow(rows, 1))?.classList.contains('bg-muscle-back-ink')).toBe(true)
		expect(getFill(getRow(rows, 2))?.classList.contains('bg-muted-soft')).toBe(true)
	})

	it('renders nothing without sets and cardio', () => {
		const { container } = renderWithProviders(<GroupsCard groups={[]} cardioMin={0} />)
		expect(container.querySelector('li')).toBeNull()
	})
})
