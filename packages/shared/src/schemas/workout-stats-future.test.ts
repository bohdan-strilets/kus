import { describe, expect, it } from 'vitest'

import { workoutStatsBucketSchema, workoutStatsCardioBucketSchema } from './workout-stats.js'

describe('isFuture of stats buckets', () => {
	it('is false for an old response without it', () => {
		const bucket = workoutStatsBucketSchema.parse({
			from: '2026-10-26',
			to: '2026-11-01',
			workoutCount: 1,
			setCount: 2,
			cardioMin: 0,
		})
		const cardio = workoutStatsCardioBucketSchema.parse({
			from: '2026-10-26',
			to: '2026-11-01',
			minutes: 5,
		})
		expect(bucket.isFuture).toBe(false)
		expect(cardio.isFuture).toBe(false)
	})

	it('keeps true and rejects a non-boolean', () => {
		const base = { from: '2026-10-26', to: '2026-10-26', minutes: 0 }
		expect(workoutStatsCardioBucketSchema.parse({ ...base, isFuture: true }).isFuture).toBe(true)
		expect(workoutStatsCardioBucketSchema.safeParse({ ...base, isFuture: 'yes' }).success).toBe(
			false,
		)
	})
})
