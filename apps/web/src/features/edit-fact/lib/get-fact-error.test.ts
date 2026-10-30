import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/shared/api'
import { i18n } from '@/shared/i18n'

import { getFactErrorMessage, getFactFieldCode, isFactGoneError } from './get-fact-error'

const t = i18n.t.bind(i18n) as TFunction

const http = (errorCode: string, details: Record<string, unknown> = {}): ApiError => ({
	kind: 'http',
	status: 422,
	errorCode,
	details,
})

const validation = (text: string): ApiError => http('VALIDATION_ERROR', { fields: { text } })

describe('getFactFieldCode', () => {
	it('reads the fact-guard issue and the length codes of a 422 about text', () => {
		expect(getFactFieldCode(validation('HEALTH_DATA'))).toBe('HEALTH_DATA')
		expect(getFactFieldCode(validation('BODY_DATA'))).toBe('BODY_DATA')
		expect(getFactFieldCode(validation('INSTRUCTION'))).toBe('INSTRUCTION')
		expect(getFactFieldCode(validation('TOO_LARGE'))).toBe('TOO_LARGE')
	})

	it('treats a duplicate as a field error too', () => {
		expect(getFactFieldCode(http('FACT_EXISTS'))).toBe('FACT_EXISTS')
	})

	it('is null for anything that is not about the text', () => {
		expect(
			getFactFieldCode(http('VALIDATION_ERROR', { fields: { other: 'TOO_LARGE' } })),
		).toBeNull()
		expect(getFactFieldCode(validation('WHAT'))).toBeNull()
		expect(getFactFieldCode(http('VALIDATION_ERROR'))).toBeNull()
		expect(getFactFieldCode(http('FACT_NOT_FOUND'))).toBeNull()
		expect(getFactFieldCode({ kind: 'network' })).toBeNull()
	})
})

describe('getFactErrorMessage', () => {
	it('says that the memory is full when a restore hits the limit', () => {
		expect(getFactErrorMessage(http('FACTS_LIMIT_REACHED'), 'restore', t)).toBe(
			"У пам'яті вже 30 фактів — щоб додати новий, прибери якийсь у «Пам'яті».",
		)
	})

	it('names a missing fact and a duplicate, falls back to the action text', () => {
		expect(getFactErrorMessage(http('FACT_NOT_FOUND'), 'delete', t)).toBe(
			'Цього факту вже немає. Онови екран.',
		)
		expect(getFactErrorMessage(http('FACT_EXISTS'), 'restore', t)).toBe('Такий факт уже є.')
		expect(getFactErrorMessage(http('X'), 'delete', t)).toBe('Не вдалося видалити. Спробуй ще раз.')
		expect(getFactErrorMessage({ kind: 'unknown' }, 'save', t)).toBe(
			'Не вдалося зберегти. Спробуй ще раз.',
		)
	})

	it('knows when the fact is gone', () => {
		expect(isFactGoneError(http('FACT_NOT_FOUND'))).toBe(true)
		expect(isFactGoneError(http('FACT_EXISTS'))).toBe(false)
	})
})

describe('the counted texts', () => {
	it.each([
		[1, "У пам'яті вже 1 факт — щоб додати новий, прибери якийсь у «Пам'яті»."],
		[22, "У пам'яті вже 22 факти — щоб додати новий, прибери якийсь у «Пам'яті»."],
		[30, "У пам'яті вже 30 фактів — щоб додати новий, прибери якийсь у «Пам'яті»."],
	])('agree the limit of %i with its noun', (count, text) => {
		expect(t('errors.api.FACTS_LIMIT_REACHED', { count })).toBe(text)
	})

	it.each([
		[1, 'Не довше 1 символу'],
		[3, 'Не довше 3 символів'],
		[120, 'Не довше 120 символів'],
	])('agree the length of %i with its noun', (count, text) => {
		expect(t('editFact.validation.tooLong', { count })).toBe(text)
		expect(t('editMyFood.validation.nameTooLong', { count })).toBe(text)
	})
})
