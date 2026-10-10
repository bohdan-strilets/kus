import { ACCOUNT_DELETION_GRACE_DAYS } from '@kus/shared'

/** The day the data is erased for good: «Передумаєш — просто увійди знову до …». */
export const getPurgeDate = (now: Date = new Date()): Date => {
	const purgeDate = new Date(now)
	purgeDate.setDate(purgeDate.getDate() + ACCOUNT_DELETION_GRACE_DAYS)
	return purgeDate
}
