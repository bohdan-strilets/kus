import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toModelParameters, toUncompactedParameters } from './model-schema.js'
import { AI_TOOL_SCHEMAS } from './tools.js'

const NULL_BRANCH = '{"type":"null"}'

const countOccurrences = (text: string, part: string): number => text.split(part).length - 1

const toValidator = (schema: unknown) => z.fromJSONSchema(schema as never)

describe('toModelParameters nullable compaction', () => {
	const tools = Object.entries(AI_TOOL_SCHEMAS)

	it('leaves no «anyOf with a null branch» in any tool', () => {
		for (const [name, schema] of tools) {
			const json = JSON.stringify(toModelParameters(schema))
			expect(json, name).not.toContain(NULL_BRANCH)
		}
	})

	it('turns each such branch into a type list, and is shorter', () => {
		let before = 0
		let after = 0
		for (const [, schema] of tools) {
			const original = JSON.stringify(toUncompactedParameters(schema))
			const compacted = JSON.stringify(toModelParameters(schema))
			before += countOccurrences(original, NULL_BRANCH)
			after += countOccurrences(compacted, `,"null"]`)
			expect(compacted.length).toBeLessThanOrEqual(original.length)
		}

		expect(before).toBeGreaterThan(0)
		expect(after).toBe(before)
	})

	it('adds null to the enum of a nullable enum, so null stays allowed', () => {
		const schema = toModelParameters(AI_TOOL_SCHEMAS.log_workout) as {
			properties: { place: { type: string[]; enum: (string | null)[] } }
		}

		expect(schema.properties.place.type).toEqual(['string', 'null'])
		expect(schema.properties.place.enum).toEqual(['GYM', 'HOME', 'OUTDOOR', 'OTHER', null])
	})
})

describe('the compacted schema accepts and rejects the same inputs', () => {
	const workout = AI_TOOL_SCHEMAS.log_workout
	const original = toValidator(toUncompactedParameters(workout))
	const compacted = toValidator(toModelParameters(workout))

	const exercise = {
		name: 'Жим лежачи',
		exerciseRef: null,
		kind: 'STRENGTH',
		sets: [{ reps: 8, weightKg: 80, count: 3, isWarmup: false }],
		durationMin: null,
		distanceKm: null,
	}
	const base = {
		date: null,
		place: null,
		durationMin: null,
		kcalBurned: null,
		exercises: [exercise],
		replaceRef: null,
		reply: 'Записав.',
	}

	it.each([
		['nulls everywhere', base, true],
		['values instead of nulls', { ...base, place: 'GYM', durationMin: 55, kcalBurned: 320 }, true],
		['a date', { ...base, date: '2026-10-27' }, true],
		['a replaceRef', { ...base, replaceRef: 'w1' }, true],
		[
			'a null in a nested exercise',
			{ ...base, exercises: [{ ...exercise, distanceKm: null }] },
			true,
		],
		['a number in an enum place', { ...base, place: 5 }, false],
		['an unknown place', { ...base, place: 'MOON' }, false],
		['a string instead of minutes', { ...base, durationMin: 'long' }, false],
		['a null name', { ...base, exercises: [{ ...exercise, name: null }] }, false],
		['no exercises', { ...base, exercises: [] }, false],
		['a negative number of minutes', { ...base, durationMin: -5 }, false],
	])('%s', (_label, input, isValid) => {
		expect(original.safeParse(input).success).toBe(isValid)
		expect(compacted.safeParse(input).success).toBe(isValid)
	})
})
