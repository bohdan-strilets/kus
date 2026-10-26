// @vitest-environment jsdom
import type { ProgressWaist } from '@kus/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/shared/i18n'

import { WaistProgressCard } from './WaistProgressCard'

afterEach(cleanup)

const TODAY = '2026-09-05'

const createWaist = (
	points: ProgressWaist['points'],
	changeInRange: number | null = null,
): ProgressWaist => ({
	current: { value: 94, localDate: points.at(-1)?.localDate ?? '2026-08-01' },
	changeInRange,
	changeSince: null,
	points,
	start: null,
	fromStart: null,
})

describe('WaistProgressCard', () => {
	it('several measurements: value, change, first caption, small end dot and the dates', () => {
		const { container } = render(
			<WaistProgressCard
				waist={createWaist(
					[
						{ localDate: '2026-08-06', value: 96 },
						{ localDate: TODAY, value: 94 },
					],
					-2,
				)}
				range={30}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('Талія')).toBeTruthy()
		expect(screen.getByText('−2,0 см')).toBeTruthy()
		expect(screen.getByRole('img', { name: 'Талія за 30 днів: від 96 см до 94 см' })).toBeTruthy()
		expect(container.querySelector('[data-sparkline-first]')?.textContent).toBe('96')
		expect(container.querySelector('[data-sparkline-last]')).toBeNull()
		expect(container.querySelector('[data-sparkline-end-dot]')?.className).toContain('size-2.5')
		expect(screen.getByText('6 серп')).toBeTruthy()
		expect(screen.getByText('сьогодні')).toBeTruthy()
	})

	it('one measurement: no change badge, one dot, one date', () => {
		const { container } = render(
			<WaistProgressCard
				waist={createWaist([{ localDate: '2026-09-02', value: 94 }], 0)}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.queryByText(/^[−+]/)).toBeNull()
		expect(container.querySelectorAll('[data-sparkline-end-dot]')).toHaveLength(1)
		expect(container.querySelector('[data-sparkline-first]')).toBeNull()
		expect(screen.getAllByText('2 вер')).toHaveLength(1)
	})

	it('no measurements in the period: the honest line instead of the chart', () => {
		const { container } = render(
			<WaistProgressCard waist={createWaist([])} range={7} today={TODAY} />,
		)

		expect(
			screen.getByText(
				/^За цей період замірів немає\. Напиши в чаті «талія 94» або натисни «Додати талію»/,
			),
		).toBeTruthy()
		expect(screen.getByText('94')).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
		expect(container.querySelector('[data-sparkline-end-dot]')).toBeNull()
	})

	it('never measured: the card stays with a dash and a hint how to start', () => {
		const { container } = render(<WaistProgressCard waist={null} range={30} today={TODAY} />)

		expect(screen.getByText('Талія')).toBeTruthy()
		expect(screen.getByText('—')).toBeTruthy()
		expect(
			screen.getByText(
				/^Замірів талії ще немає. Напиши в чаті «талія 94» або натисни «Додати талію»/,
			),
		).toBeTruthy()
		expect(screen.queryByText('см')).toBeNull()
		expect(screen.queryByRole('img')).toBeNull()
		expect(container.querySelector('[data-sparkline-end-dot]')).toBeNull()
	})
})

describe('WaistProgressCard start row', () => {
	it('shows the start like the weight does: value, date and the change from it', () => {
		render(
			<WaistProgressCard
				waist={{
					...createWaist([{ localDate: TODAY, value: 99 }]),
					start: { value: 102, localDate: '2026-10-09' },
					fromStart: -3,
				}}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('102 см')).toBeTruthy()
		expect(screen.getByText(/· 9 жовт/)).toBeTruthy()
		expect(screen.getByText('−3,0 см').className).toContain('text-success-ink')
	})

	it('has no row without a start', () => {
		render(
			<WaistProgressCard
				waist={createWaist([{ localDate: TODAY, value: 99 }])}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.queryByText('Старт')).toBeNull()
	})
})

describe('WaistProgressCard one measurement in the period', () => {
	const points = [{ localDate: TODAY, value: 99 }]

	it('shows the change since the earlier measurement with its date', () => {
		render(
			<WaistProgressCard
				waist={{ ...createWaist(points), changeSince: { change: -3, sinceDate: '2026-10-09' } }}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('−3,0 см з 9 жовт')).toBeTruthy()
		expect(screen.queryByText('За цей період лише один замір')).toBeNull()
	})

	it('without an earlier measurement says there is only one', () => {
		render(<WaistProgressCard waist={createWaist(points)} range={7} today={TODAY} />)

		expect(screen.getByText('За цей період лише один замір')).toBeTruthy()
	})

	it('with two measurements shows the change of the range, no note', () => {
		render(
			<WaistProgressCard
				waist={createWaist(
					[
						{ localDate: '2026-09-01', value: 96 },
						{ localDate: TODAY, value: 94 },
					],
					-2,
				)}
				range={7}
				today={TODAY}
			/>,
		)

		expect(screen.getByText('−2,0 см')).toBeTruthy()
		expect(screen.queryByText('За цей період лише один замір')).toBeNull()
	})
})
