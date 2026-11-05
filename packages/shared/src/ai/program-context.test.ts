import { describe, expect, it } from 'vitest'

import {
	assignTemplateRefs,
	formatProgramSection,
	isProgramTopic,
	type ProgramContext,
	type ProgramProposalContext,
	shouldShowProgramRules,
} from './program-context.js'

const program: ProgramContext = {
	mode: 'ROTATE',
	perWeek: 3,
	title: 'Все тіло',
	nextRef: 't2',
	templates: [
		{
			ref: 't1',
			name: 'Тренування А',
			weekdays: [1, 4],
			exercises: [
				{
					name: 'Бігова доріжка',
					exerciseRef: null,
					sets: null,
					repsMin: null,
					repsMax: null,
					weightKg: null,
					durationMin: 10,
					distanceKm: null,
				},
				{
					name: 'Жим лежачи',
					exerciseRef: 'x3',
					sets: 3,
					repsMin: 8,
					repsMax: 12,
					weightKg: 60,
					durationMin: null,
					distanceKm: null,
				},
			],
		},
		{
			ref: 't2',
			name: 'Тренування Б',
			weekdays: [],
			exercises: [
				{
					name: 'Підтягування',
					exerciseRef: null,
					sets: 3,
					repsMin: 8,
					repsMax: 8,
					weightKg: null,
					durationMin: null,
					distanceKm: null,
				},
			],
		},
	],
}

const FIRST_RULE =
	'- The user often discusses the program first: answer and suggest in words (reply). Call propose_program only when the user asks to make or change it, or agrees.'
const LAST_RULE =
	"- Removing the program: only «Прибрати програму» on the program screen; you can't remove it — say where it is."

describe('formatProgramSection', () => {
	it('shows the program with t-refs, x-refs, compact targets, next and the rules', () => {
		const lines = formatProgramSection({ program })

		expect(lines.slice(0, 4)).toEqual([
			'# Program',
			'Active: ROTATE, 3 per week, "Все тіло". Next: t2.',
			't1 "Тренування А" [Mon, Thu]: Бігова доріжка 10 min; x3 Жим лежачи 3×8–12 60 kg',
			't2 "Тренування Б": Підтягування 3×8',
		])
		expect(lines[4]).toBe(FIRST_RULE)
		expect(lines.at(-1)).toBe(LAST_RULE)
		expect(lines).toHaveLength(12)
	})

	it('leaves out what the program does not have', () => {
		const [, active] = formatProgramSection({
			program: { ...program, mode: 'SINGLE', perWeek: null, title: null, nextRef: null },
		})

		expect(active).toBe('Active: SINGLE.')
	})

	it('gives only the rules without a program when the message talks about one', () => {
		const lines = formatProgramSection({ program: null, hasProgramRules: true })

		expect(lines[0]).toBe('# Program')
		expect(lines[1]).toBe(FIRST_RULE)
		expect(lines).toHaveLength(9)
	})

	it('asks for a program on the last onboarding step', () => {
		const lines = formatProgramSection({ programOnboarding: 'place GYM; 3 per week' })

		expect(lines.at(-1)).toBe(
			'Onboarding answers: place GYM; 3 per week. Propose a program for them with propose_program.',
		)
	})

	it('shows the open proposal after the active program, then the rules', () => {
		const pending: ProgramProposalContext = {
			mode: 'ROTATE',
			perWeek: 2,
			title: null,
			templates: [
				{
					ref: 't2',
					name: 'Тренування Б',
					weekdays: [],
					exercises: program.templates[1]?.exercises ?? [],
				},
				{
					ref: 't3',
					name: 'Тренування В',
					weekdays: [3],
					exercises: program.templates[1]?.exercises ?? [],
				},
			],
		}
		const lines = formatProgramSection({ program, pendingProgram: pending })

		expect(lines.slice(3, 8)).toEqual([
			't2 "Тренування Б": Підтягування 3×8',
			'Proposal not accepted yet (the card in the chat), build changes on it:',
			'ROTATE, 2 per week.',
			't2 "Тренування Б": Підтягування 3×8',
			't3 "Тренування В" [Wed]: Підтягування 3×8',
		])
		expect(lines[8]).toBe(FIRST_RULE)
	})

	it('shows the open proposal without an active program', () => {
		const lines = formatProgramSection({
			pendingProgram: { mode: 'SINGLE', perWeek: null, title: 'Дім', templates: [] },
		})

		expect(lines.slice(0, 3)).toEqual([
			'# Program',
			'Proposal not accepted yet (the card in the chat), build changes on it:',
			'SINGLE, "Дім".',
		])
		expect(lines[3]).toBe(FIRST_RULE)
	})

	it('is absent without a program, a program topic or the onboarding', () => {
		expect(formatProgramSection({})).toEqual([])
		expect(formatProgramSection({ program: null, hasProgramRules: false })).toEqual([])
	})
})

describe('isProgramTopic', () => {
	it.each([
		'склади мені програму',
		'зміни шаблон Б',
		'хочу тренуватись 3 рази на тиждень',
		'5 разів на тиждень',
		'ułóż mi program',
		'3 razy w tygodniu',
	])('is a program topic: %s', (text) => {
		expect(isProgramTopic(text)).toBe(true)
	})

	it.each([
		'програма',
		'покажи програму',
		'в програмі забагато',
		'немає програми',
		'з програмою легше',
		'Програм у мене не було',
	])('keeps the forms of «програма»: %s', (text) => {
		expect(isProgramTopic(text)).toBe(true)
	})

	it.each([
		'зал: жим 80 3×8',
		'пробіг 5 км',
		'гречка 200 г',
		'після програмування поїв піцу',
		'програмний код',
		'програмна помилка',
		'програмувати до ночі',
		'po programowaniu',
		'jestem programistą',
	])('is not: %s', (text) => {
		expect(isProgramTopic(text)).toBe(false)
	})
})

describe('shouldShowProgramRules', () => {
	const turns = (...contents: string[]) => contents.map((content) => ({ content }))

	it('takes the message or one of the last 4 turns of the history', () => {
		expect(
			shouldShowProgramRules({ text: 'склади програму', history: [], hasProgram: false }),
		).toBe(true)
		expect(
			shouldShowProgramRules({
				text: 'давай так',
				history: turns('3 рази на тиждень?', 'Можна 3 тренування.', 'ок', 'Тоді почнемо.'),
				hasProgram: false,
			}),
		).toBe(true)
	})

	it('ignores a turn older than the last 4 and any talk with a program already there', () => {
		expect(
			shouldShowProgramRules({
				text: 'давай так',
				history: turns('склади програму', 'Готово.', 'гречка', 'Записав.', 'ок'),
				hasProgram: false,
			}),
		).toBe(false)
		expect(shouldShowProgramRules({ text: 'склади програму', history: [], hasProgram: true })).toBe(
			false,
		)
	})
})

describe('assignTemplateRefs', () => {
	it('numbers the active templates, reuses their refs by key and continues for new ones', () => {
		expect(assignTemplateRefs(['a', 'b'], ['b', 'new1', 'a', 'new2'])).toEqual({
			active: ['t1', 't2'],
			proposal: ['t2', 't3', 't1', 't4'],
		})
	})

	it('numbers a proposal from t1 without a program', () => {
		expect(assignTemplateRefs([], ['x', 'y'])).toEqual({ active: [], proposal: ['t1', 't2'] })
	})
})
