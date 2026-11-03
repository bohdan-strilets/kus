import { FORM_MAX_DAYS_BACK } from '@kus/shared'

import { shiftLocalDate } from '@/shared/lib'

export interface FormDateOption {
	/** `YYYY-MM-DD`. */
	localDate: string
	/** 0 = today, 1 = yesterday, up to `FORM_MAX_DAYS_BACK`. */
	daysBack: number
}

/** «Сьогодні · Вчора · ще 2 дні»: the days a training can be filled in for, newest first. */
export const getFormDateOptions = (today: string): FormDateOption[] =>
	Array.from({ length: FORM_MAX_DAYS_BACK + 1 }, (_, daysBack) => ({
		localDate: shiftLocalDate(today, -daysBack),
		daysBack,
	}))
