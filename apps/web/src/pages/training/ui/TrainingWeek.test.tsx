// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'
import { makeProgram, makeTemplate, makeWorkout, renderWithProviders } from '@/shared/testing'

import { getJournalRow } from '../lib/get-journal-row'
import { getProgramWeekProgress } from '../lib/get-program-progress'
import { getWeekSubtitle } from '../lib/get-week-subtitle'
import { getWeekSummary } from '../lib/get-week-summary'
import { TrainingWeek } from './TrainingWeek'

afterEach(cleanup)

const t = i18n.t.bind(i18n)

// the week 26.10 – 01.11 (Mon … Sun) and the week before it
const TODAY = '2026-10-28'
const MONDAY = '2026-10-26'
const PREV_THURSDAY = '2026-10-22'

const at = (localDate: string, hour: number, minute: number) => {
	const [year = 0, month = 1, day = 1] = localDate.split('-').map(Number)
	return new Date(year, month - 1, day, hour, minute).toISOString()
}

const trained = (id: string, localDate: string, hour = 18) =>
	makeWorkout({ id, localDate, startedAt: at(localDate, hour, 0), durationMin: 60 })

const weekdaysProgram = (weekdays: number[][]) =>
	makeProgram({
		mode: 'WEEKDAYS',
		templates: weekdays.map((days, index) =>
			makeTemplate({ id: `0199b3a4-0000-7000-8000-00000000010${index}`, weekdays: days }),
		),
	})

describe('getProgramWeekProgress', () => {
	const summary = getWeekSummary(
		[trained('a', '2026-10-26'), trained('b', '2026-10-27'), trained('c', '2026-10-31')],
		TODAY,
	)

	it('counts the program days that got a training', () => {
		// Monday and Wednesday and Friday are the program's; Monday is done, Tuesday is not a program day
		expect(getProgramWeekProgress(summary, new Set([1, 3, 5]))).toEqual({ done: 1, total: 3 })
	})

	it('does not count trainings on days outside the program', () => {
		expect(getProgramWeekProgress(summary, new Set([2, 6]))).toEqual({ done: 2, total: 2 })
		expect(getProgramWeekProgress(summary, new Set([4]))).toEqual({ done: 0, total: 1 })
	})

	it('is null without a weekly plan', () => {
		expect(getProgramWeekProgress(summary, new Set())).toBeNull()
	})

	it('counts one program day with two trainings once', () => {
		const twice = getWeekSummary([trained('a', MONDAY), trained('b', MONDAY, 20)], TODAY)

		expect(getProgramWeekProgress(twice, new Set([1]))).toEqual({ done: 1, total: 1 })
	})
})

describe('getWeekSubtitle', () => {
	const summary = getWeekSummary([trained('a', MONDAY)], TODAY)

	it('says the program progress when there is one', () => {
		expect(getWeekSubtitle(summary, t, { done: 1, total: 3 })).toBe('1 з 3 за програмою')
	})

	it('falls back to the count and the time without a weekly plan', () => {
		expect(getWeekSubtitle(summary, t, null)).toBe('1 тренування · 1 год')
		expect(getWeekSubtitle(summary, t)).toBe('1 тренування · 1 год')
	})

	it('says «ще без тренувань» for an empty week without a plan', () => {
		expect(getWeekSubtitle(getWeekSummary([], TODAY), t)).toBe('ще без тренувань')
	})

	it('keeps «0 з 3 за програмою» for an empty week with a plan', () => {
		expect(getWeekSubtitle(getWeekSummary([], TODAY), t, { done: 0, total: 3 })).toBe(
			'0 з 3 за програмою',
		)
	})
})

describe('getJournalRow time', () => {
	const workout = makeWorkout({ localDate: MONDAY, startedAt: at(MONDAY, 7, 10) })

	it('gives the start time only when asked, with no extra data', () => {
		expect(getJournalRow(workout, t).time).toBeNull()
		expect(getJournalRow(workout, t, { isTimeShown: true }).time).toBe('07:10')
	})

	it('has no time for a workout without a start', () => {
		const row = getJournalRow({ ...workout, startedAt: null }, t, { isTimeShown: true })

		expect(row.time).toBeNull()
	})

	it('puts the time into the spoken label too', () => {
		expect(getJournalRow(workout, t, { isTimeShown: true }).ariaLabel).toContain('07:10')
		expect(getJournalRow(workout, t).ariaLabel).not.toContain('07:10')
	})
})

describe('TrainingWeek', () => {
	const journal = [
		trained('cur', MONDAY),
		trained('prev-a', PREV_THURSDAY),
		trained('prev-b', '2026-10-24'),
	]

	it('says «N з M за програмою» for a WEEKDAYS program', () => {
		renderWithProviders(
			<TrainingWeek today={TODAY} journal={journal} program={weekdaysProgram([[1], [3], [5]])} />,
		)

		expect(screen.getByText('1 з 3 за програмою')).toBeTruthy()
		expect(screen.getByText('Цей тиждень')).toBeTruthy()
	})

	it('counts a past week against the program too, with its own dates in the title', () => {
		renderWithProviders(
			<TrainingWeek today={TODAY} journal={journal} program={weekdaysProgram([[4], [6], [7]])} />,
		)

		fireEvent.click(screen.getByRole('button', { name: 'Попередній тиждень' }))

		// Thursday and Saturday of the week before were trained, Sunday was not
		expect(screen.getByText('2 з 3 за програмою')).toBeTruthy()
		expect(screen.queryByText('Цей тиждень')).toBeNull()
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Наступний тиждень' }).disabled,
		).toBe(false)
	})

	it('falls back to the count for a program that is not tied to weekdays', () => {
		renderWithProviders(
			<TrainingWeek
				today={TODAY}
				journal={journal}
				program={makeProgram({ mode: 'ROTATE', templates: [makeTemplate({ weekdays: [1, 3] })] })}
			/>,
		)

		expect(screen.getByText('1 тренування · 1 год')).toBeTruthy()
		expect(screen.queryByText(/за програмою/)).toBeNull()
	})

	it('falls back to the count with no program at all', () => {
		renderWithProviders(<TrainingWeek today={TODAY} journal={journal} program={null} />)

		expect(screen.getByText('1 тренування · 1 год')).toBeTruthy()
	})

	it('rows of a day sheet carry the start time: «· 07:10»', () => {
		const twoInADay = [
			makeWorkout({ id: 'am', localDate: MONDAY, startedAt: at(MONDAY, 7, 10), durationMin: 30 }),
			makeWorkout({ id: 'pm', localDate: MONDAY, startedAt: at(MONDAY, 18, 45), durationMin: 60 }),
		]
		renderWithProviders(<TrainingWeek today={TODAY} journal={twoInADay} program={null} />)

		fireEvent.click(screen.getByRole('button', { name: /^Понеділок, 26 жовтня: тренування/ }))

		const list = screen.getByRole('list', { name: 'Тренування дня' })
		expect(within(list).getAllByRole('link')).toHaveLength(2)
		expect(within(list).getByText('· 07:10')).toBeTruthy()
		expect(within(list).getByText('· 18:45')).toBeTruthy()
	})

	it('a single training of the day opens its session directly (no sheet)', () => {
		renderWithProviders(<TrainingWeek today={TODAY} journal={journal} program={null} />)

		fireEvent.click(screen.getByRole('button', { name: /^Понеділок, 26 жовтня: тренування/ }))

		expect(screen.queryByRole('list', { name: 'Тренування дня' })).toBeNull()
	})
})

describe('TrainingWeek: renderCurrentOnly', () => {
	const journal = [trained('cur', MONDAY), trained('prev', PREV_THURSDAY)]
	const renderWeek = () =>
		renderWithProviders(
			<TrainingWeek
				today={TODAY}
				journal={journal}
				program={null}
				renderCurrentOnly={() => <p>Порожнє тренування</p>}
			/>,
		)

	it('is shown on the current week', () => {
		renderWeek()

		expect(screen.getByText('Порожнє тренування')).toBeTruthy()
	})

	it('is hidden on a past week and comes back with the current one', () => {
		renderWeek()

		fireEvent.click(screen.getByRole('button', { name: 'Попередній тиждень' }))
		expect(screen.queryByText('Порожнє тренування')).toBeNull()

		fireEvent.click(screen.getByRole('button', { name: 'Наступний тиждень' }))
		expect(screen.getByText('Порожнє тренування')).toBeTruthy()
	})

	it('without the render prop nothing extra is drawn', () => {
		renderWithProviders(<TrainingWeek today={TODAY} journal={journal} program={null} />)

		expect(screen.queryByText('Порожнє тренування')).toBeNull()
	})
})
