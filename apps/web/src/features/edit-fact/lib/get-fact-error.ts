import { FACT_TEXT_ISSUES, FACTS_MAX } from '@kus/shared'
import type { TFunction } from 'i18next'

import type { ApiError } from '@/shared/api'

import type { FactFieldCode } from '../model/edit-fact.schema'

export type FactAction = 'save' | 'delete' | 'restore'

const ACTION_ERROR_KEY = {
	save: 'editFact.saveError',
	delete: 'editFact.deleteError',
	restore: 'editFact.restoreError',
} as const

/** The toast after a save, a delete or a restore that didn't go through. */
export const getFactErrorMessage = (error: ApiError, action: FactAction, t: TFunction): string => {
	if (error.kind === 'network') return t('errors.api.NETWORK')
	if (error.kind === 'http') {
		if (error.errorCode === 'FACT_NOT_FOUND') return t('errors.api.FACT_NOT_FOUND')
		if (error.errorCode === 'FACT_EXISTS') return t('errors.api.FACT_EXISTS')
		if (error.errorCode === 'FACTS_LIMIT_REACHED') {
			// on the «Пам'ять» screen itself: no «у «Пам'яті»» at the end (the chat keeps the full sentence)
			return t('editFact.limitReached', { count: FACTS_MAX })
		}
	}
	return t(ACTION_ERROR_KEY[action])
}

export const isFactGoneError = (error: ApiError): boolean =>
	error.kind === 'http' && error.errorCode === 'FACT_NOT_FOUND'

const isFactTextIssue = (code: unknown): code is (typeof FACT_TEXT_ISSUES)[number] =>
	FACT_TEXT_ISSUES.some((issue) => issue === code)

/** A rejected save the form shows under the field: a 409 duplicate or a 422 about `text`; null — not about it. */
export const getFactFieldCode = (error: ApiError): FactFieldCode | null => {
	if (error.kind !== 'http') return null
	if (error.errorCode === 'FACT_EXISTS') return 'FACT_EXISTS'
	if (error.errorCode !== 'VALIDATION_ERROR') return null
	const { fields } = error.details
	if (typeof fields !== 'object' || fields === null) return null
	const code: unknown = (fields as Record<string, unknown>).text
	if (code === 'TOO_SMALL' || code === 'TOO_LARGE') return code
	return isFactTextIssue(code) ? code : null
}
