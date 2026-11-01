import { describe, expect, it } from 'vitest'

import { i18n } from '@/shared/i18n'

import { formatLastSets } from './format-last-sets'

const t = i18n.t.bind(i18n)

describe('formatLastSets', () => {
	it('is null when the exercise was never done', () => {
		expect(formatLastSets(null, t)).toBeNull()
	})

	it('folds equal working sets and drops the warm-up', () => {
		const result = formatLastSets(
			[
				{ reps: 10, weightKg: 20, isWarmup: true },
				{ reps: 12, weightKg: 50, isWarmup: false },
				{ reps: 12, weightKg: 50, isWarmup: false },
				{ reps: 12, weightKg: 50, isWarmup: false },
			],
			t,
		)

		expect(result?.segments).toEqual([{ kind: 'work', text: '50×12', multiplier: 3 }])
	})

	it('writes bodyweight sets as reps with the unit', () => {
		const result = formatLastSets(
			[
				{ reps: 8, weightKg: null, isWarmup: false },
				{ reps: 7, weightKg: null, isWarmup: false },
			],
			t,
		)

		expect(result?.segments.map((segment) => segment.text)).toEqual(['8', '7'])
		expect(result?.unit).toBe('повт.')
	})

	it('is null when only warm-ups were done', () => {
		expect(formatLastSets([{ reps: 10, weightKg: 20, isWarmup: true }], t)).toBeNull()
	})
})
