import { describe, expect, it } from 'vitest'

import uk from './locales/uk.json'

type Json = string | { [key: string]: Json }

// the sources of the new components, read as text
const SOURCES = import.meta.glob<string>(
	[
		'../ui/week-strip/WeekStrip.tsx',
		'../../entities/stats/ui/food-week-strip/FoodWeekStrip.tsx',
		'../../entities/workout/lib/format-workout-kcal.ts',
		'../../entities/workout/ui/kcal-info-sheet/KcalInfoSheet.tsx',
		'../../entities/workout/ui/workout-day-dots/WorkoutDayDots.tsx',
		'../../pages/training/lib/get-training-week-days.ts',
		'../../pages/training/lib/get-week-subtitle.ts',
		'../../pages/training/ui/TrainingWeek.tsx',
		'../../pages/training/ui/TrainingDaySheet.tsx',
		'../../pages/training/ui/NextWorkoutCard.tsx',
		'../../pages/training-session/ui/SessionKcalLine.tsx',
		'../../pages/training-stats/ui/KcalTile.tsx',
		'../../pages/training-stats/ui/CardioExercises.tsx',
		'../../pages/today/lib/get-training-strip-view.ts',
		'../../pages/today/ui/TodayTrainingStrip.tsx',
		'../../widgets/chat-feed/ui/SessionSummaryCard.tsx',
		'../ui/hamster/hamster.constants.ts',
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

// the copy about trainings and kcal: not the whole file (goals.etaMaintain says «дефіциту» legitimately)
const KCAL_COPY_PATTERN = /^(training\.|workout\.|today\.training|week\.|hamster\.mood\.)/
const KCAL_COPY = [...ALL].filter(([key]) => KCAL_COPY_PATTERN.test(key))

// «Спалено на тренуваннях» is allowed: only the verb in the first person past is forbidden
const FORBIDDEN = ["можна з'їсти ще", 'доїж', 'дефіцит', 'заробив', 'спалив']

// plural forms: `count_one`, `count_other` stand for the key `count`
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const hasKey = (key: string): boolean =>
	ALL.has(key) ||
	[...ALL.keys()].some((existing) => existing.replace(PLURAL_SUFFIX, '') === key) ||
	[...ALL.keys()].some((existing) => existing.startsWith(`${key}.`))

const NEW_FILES = Object.keys(SOURCES)

// a literal that looks like an i18n key: `workout.kcal.value`, `today.trainingStrip.aria.open`
const KEY_LITERAL = /['"`]((?:[a-z][A-Za-z]*)(?:\.[A-Za-z_]+)+)['"`]/g
const KEY_ROOTS = new Set([
	'workout',
	'training',
	'today',
	'week',
	'hamster',
	'muscle',
	'todayAhead',
])

const getUsedKeys = (file: string): string[] => {
	const keys: string[] = []
	for (const match of (SOURCES[file] ?? '').matchAll(KEY_LITERAL)) {
		const key = match[1] ?? ''
		if (KEY_ROOTS.has(key.split('.')[0] ?? '')) keys.push(key)
	}
	return keys
}

describe('uk.json copy about trainings and kcal', () => {
	it('finds the copy it guards', () => {
		expect(KCAL_COPY.length).toBeGreaterThan(50)
		expect(KCAL_COPY.some(([key]) => key === 'workout.kcal.info.notGoal')).toBe(true)
		expect(KCAL_COPY.some(([key]) => key === 'hamster.mood.dumbbell')).toBe(true)
	})

	it.each(FORBIDDEN)('never says «%s»', (word) => {
		const offenders = KCAL_COPY.filter(([, text]) =>
			text.toLocaleLowerCase('uk').includes(word),
		).map(([key]) => key)

		expect(offenders).toEqual([])
	})

	it('allows «Спалено на тренуваннях»', () => {
		expect(ALL.get('training.stats.overview.kcalTile.title')).toContain('Спалено на тренуваннях')
	})

	it('never puts food kcal next to training kcal in one value or one block', () => {
		const offenders = KCAL_COPY.filter(([key, text]) => {
			const lower = text.toLocaleLowerCase('uk')
			const block = key.slice(0, key.lastIndexOf('.'))
			const hasBoth = (value: string): boolean =>
				value.includes('з їжі') && value.includes('з тренувань')
			if (hasBoth(lower)) return true
			const siblings = KCAL_COPY.filter(([other]) => other.startsWith(`${block}.`))
			return (
				siblings.some(([, value]) => value.toLocaleLowerCase('uk').includes('з їжі')) &&
				siblings.some(([, value]) => value.toLocaleLowerCase('uk').includes('з тренувань'))
			)
		}).map(([key]) => key)

		expect(offenders).toEqual([])
	})

	it('has no leftover keys of the replaced kcal row and week states', () => {
		const leftovers = [...ALL.keys()].filter(
			(key) =>
				key.startsWith('training.stats.cardio.kcalNote') ||
				key.startsWith('training.journal.week.dayTrained') ||
				key.startsWith('training.journal.week.dayRest'),
		)

		expect(leftovers).toEqual([])
	})
})

describe('keys of the new components', () => {
	it.each(NEW_FILES)('%s uses only keys that exist in uk.json', (file) => {
		const missing = getUsedKeys(file).filter((key) => !hasKey(key))

		expect(missing).toEqual([])
	})

	it('reads at least one key from the files that translate', () => {
		expect(getUsedKeys('../../pages/training-stats/ui/KcalTile.tsx')).toContain(
			'workout.kcal.infoAria',
		)
		expect(getUsedKeys('../../entities/workout/ui/kcal-info-sheet/KcalInfoSheet.tsx')).toContain(
			'workout.kcal.info.ok',
		)
	})
})
