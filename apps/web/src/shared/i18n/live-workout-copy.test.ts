import { describe, expect, it } from 'vitest'

import uk from './locales/uk.json'

type Json = string | { [key: string]: Json }

// the sources of stage 0.10.3 / C5 (live mode, form, finish, strip, set steppers, home cards), as text
const SOURCES = import.meta.glob<string>(
	[
		'../ui/set-stepper/*.{ts,tsx}',
		'../ui/dashed-action/*.{ts,tsx}',
		'../lib/use-now.ts',
		'../../entities/workout/api/live-*.ts',
		'../../entities/workout/api/post-workout-form.ts',
		'../../entities/workout/lib/{get-live-action-error,plan-sets,set-edit,format-session-header,format-workout-counts,get-session-summary}.ts',
		'../../entities/workout/model/*live*.ts',
		'../../entities/workout/ui/set-row/*.tsx',
		'../../entities/workout/ui/set-fields/*.tsx',
		'../../entities/workout/ui/exercise-picker/*.tsx',
		'../../entities/workout/ui/session-tiles/*.tsx',
		'../../features/live-workout/**/*.{ts,tsx}',
		'../../features/workout-form/**/*.{ts,tsx}',
		'../../pages/training-live/**/*.{ts,tsx}',
		'../../pages/training-fill/**/*.{ts,tsx}',
		'../../pages/training/ui/{NextWorkoutCard,OpenWorkoutCard,EmptyWorkoutCard,NoProgramStart,TrainingWeek,TrainingDaySheet}.tsx',
		'../../pages/training/lib/{get-program-progress,get-week-subtitle,get-journal-row}.ts',
		'../../widgets/workout-finish/**/*.{ts,tsx}',
		'../../widgets/workout-mini-strip/**/*.{ts,tsx}',
		'../../pages/training-session/ui/SessionExercise.tsx',
		'../../pages/training-template/ui/TargetForm.tsx',
		'../../pages/training-template/ui/StrengthFields.tsx',
		'!../../**/*.test.{ts,tsx}',
	],
	{ query: '?raw', import: 'default', eager: true },
)

const flatten = (node: Json, prefix = ''): Map<string, string> => {
	const result = new Map<string, string>()
	if (typeof node === 'string') {
		result.set(prefix, node)
		return result
	}
	for (const [key, value] of Object.entries(node)) {
		for (const [path, text] of flatten(value, prefix === '' ? key : `${prefix}.${key}`)) {
			result.set(path, text)
		}
	}
	return result
}

const ALL = flatten(uk)

// plural forms: `count_one`, `count_other` stand for the key `count`
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const hasKey = (key: string): boolean =>
	ALL.has(key) ||
	[...ALL.keys()].some((existing) => existing.replace(PLURAL_SUFFIX, '') === key) ||
	[...ALL.keys()].some((existing) => existing.startsWith(`${key}.`))

const FILES = Object.keys(SOURCES)

const KEY_LITERAL = /['"`]((?:[a-z][A-Za-z]*)(?:\.[A-Za-z_0-9]+)+)['"`]/g
const KEY_ROOTS = new Set([
	'workout',
	'training',
	'today',
	'week',
	'hamster',
	'muscle',
	'program',
	'common',
	'errors',
	'todayAhead',
])

const FORBIDDEN = ["можна з'їсти ще", 'доїж', 'дефіцит', 'заробив', 'спалив']

const getUsedKeys = (file: string): string[] =>
	[...(SOURCES[file] ?? '').matchAll(KEY_LITERAL)]
		.map((match) => match[1] ?? '')
		.filter((key) => KEY_ROOTS.has(key.split('.')[0] ?? ''))

const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm

const stripComments = (source: string): string =>
	source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1')

describe('copy of the live mode, the form and the home cards', () => {
	it('finds the files it guards', () => {
		expect(FILES.length).toBeGreaterThan(60)
		expect(FILES.some((file) => file.endsWith('create-live-sync.ts'))).toBe(true)
		expect(FILES.some((file) => file.endsWith('FillScreen.tsx'))).toBe(true)
		expect(FILES.some((file) => file.endsWith('WorkoutMiniStrip.tsx'))).toBe(true)
		expect(FILES.some((file) => file.endsWith('.test.tsx'))).toBe(false)
	})

	it.each(FILES)('%s uses only keys that exist in uk.json', (file) => {
		const missing = getUsedKeys(file).filter((key) => !hasKey(key))

		expect(missing).toEqual([])
	})

	it('reads the keys of the main screens', () => {
		expect(getUsedKeys('../../pages/training-live/ui/LiveSetList.tsx')).toContain(
			'training.live.setDone',
		)
		expect(getUsedKeys('../../features/live-workout/ui/ClosedByChatCard.tsx')).toContain(
			'training.live.closedByChat',
		)
		expect(getUsedKeys('../../pages/training-fill/ui/FillScreen.tsx')).toContain(
			'training.form.save',
		)
	})

	it('has the words of every key the new files use free of the forbidden ones', () => {
		const used = new Set(FILES.flatMap(getUsedKeys))
		const offenders = [...ALL]
			.filter(([key]) => [...used].some((u) => key === u || key.startsWith(`${u}.`)))
			.filter(([, text]) => FORBIDDEN.some((word) => text.toLocaleLowerCase('uk').includes(word)))
			.map(([key]) => key)

		expect(offenders).toEqual([])
	})

	it('has no forbidden words in training.* and workout.* (the whole branch)', () => {
		const offenders = [...ALL]
			.filter(([key]) => key.startsWith('training.') || key.startsWith('workout.'))
			.filter(([, text]) => FORBIDDEN.some((word) => text.toLocaleLowerCase('uk').includes(word)))
			.map(([key]) => key)

		expect(offenders).toEqual([])
	})

	it('has no Ukrainian text hardcoded in the new files (everything goes through t())', () => {
		const offenders = FILES.filter((file) => CYRILLIC.test(stripComments(SOURCES[file] ?? '')))

		expect(offenders).toEqual([])
	})
})

describe('the texts of C5, word for word', () => {
	it.each([
		['training.live.syncError', 'Не вдалося зберегти підходи. Спробуй ще раз.'],
		['training.live.loadError', 'Не вдалося завантажити тренування.'],
		['training.form.loadError', 'Не вдалося завантажити програму.'],
		['training.form.validation.range', 'Вкажи від {{min}} до {{max}}'],
		['training.form.validation.dateOutOfRange', 'Обери сьогодні або один із трьох попередніх днів'],
		['training.form.validation.startInFuture', 'Початок у майбутньому — вкажи раніше.'],
		[
			'training.live.exit.description',
			'{{summary}} Можна продовжити пізніше — тренування закриється саме, якщо від останнього підходу мине понад {{hours}} {{unit}}.',
		],
	])('%s', (key, text) => {
		expect(ALL.get(key)).toBe(text)
	})

	it('has the plural forms of the hours unit and no «Продовжити пізніше» button text', () => {
		expect(
			['one', 'few', 'many', 'other'].map((form) =>
				ALL.get(`training.live.exit.hoursUnit_${form}`),
			),
		).toEqual(['година', 'години', 'годин', 'години'])
		expect(ALL.has('training.live.exit.later')).toBe(false)
		expect([...ALL.values()]).not.toContain('Продовжити пізніше')
	})
})
