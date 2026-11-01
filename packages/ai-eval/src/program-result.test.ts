import type { FoodParseDecision } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getLoggedProgram } from './program-result.js'

describe('getLoggedProgram', () => {
	it('keeps the mode, the pin and per template the ref, weekdays and exercise weights', () => {
		const decision = {
			kind: 'program',
			program: {
				mode: 'SINGLE',
				pinnedRef: 't1',
				templates: [
					{
						ref: 't1',
						name: 'Тренування А',
						weekdays: [1],
						exercises: [{ name: 'Жим', weightKg: 60, sets: 3 }],
					},
				],
			},
		} as unknown as FoodParseDecision
		expect(getLoggedProgram(decision)).toEqual({
			mode: 'SINGLE',
			pinnedRef: 't1',
			templates: [
				{
					ref: 't1',
					name: 'Тренування А',
					weekdays: [1],
					exercises: [{ name: 'Жим', weightKg: 60 }],
				},
			],
		})
	})

	it('is null for any other decision', () => {
		expect(getLoggedProgram({ kind: 'reply', text: 'ок' } as FoodParseDecision)).toBeNull()
	})
})
