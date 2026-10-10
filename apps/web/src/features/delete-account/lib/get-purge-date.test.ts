import { ACCOUNT_DELETION_GRACE_DAYS } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getPurgeDate } from './get-purge-date'

describe('getPurgeDate', () => {
	it('is the grace period after now', () => {
		const now = new Date(2026, 9, 10, 12)

		expect(getPurgeDate(now)).toEqual(new Date(2026, 9, 10 + ACCOUNT_DELETION_GRACE_DAYS, 12))
	})

	it('does not change the date it was given', () => {
		const now = new Date(2026, 9, 10, 12)
		getPurgeDate(now)

		expect(now).toEqual(new Date(2026, 9, 10, 12))
	})
})
