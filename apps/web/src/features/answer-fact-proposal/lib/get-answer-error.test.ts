import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { ApiError } from '@/shared/api'

import { getAnswerErrorOutcome } from './get-answer-error'

const t = ((key: string) => key) as TFunction

const http = (status: number, errorCode: string): ApiError => ({
	kind: 'http',
	status,
	errorCode,
	details: {},
})

describe('getAnswerErrorOutcome', () => {
	it('puts the limit sentence into the plaque and keeps the proposal open', () => {
		expect(getAnswerErrorOutcome(http(409, 'FACTS_LIMIT_REACHED'), t)).toEqual({
			notice: 'errors.api.FACTS_LIMIT_REACHED',
			toast: null,
			shouldRefresh: false,
		})
	})

	it('reloads quietly when the fact was already answered', () => {
		expect(getAnswerErrorOutcome(http(409, 'FACT_NOT_PROPOSED'), t)).toEqual({
			notice: null,
			toast: null,
			shouldRefresh: true,
		})
	})

	it('toasts and reloads when the fact is gone', () => {
		expect(getAnswerErrorOutcome(http(404, 'FACT_NOT_FOUND'), t)).toEqual({
			notice: null,
			toast: 'errors.api.FACT_NOT_FOUND',
			shouldRefresh: true,
		})
	})

	it('toasts the connection error without reloading', () => {
		expect(getAnswerErrorOutcome({ kind: 'network' }, t)).toEqual({
			notice: null,
			toast: 'errors.api.NETWORK',
			shouldRefresh: false,
		})
	})

	it('toasts a generic message for anything else', () => {
		expect(getAnswerErrorOutcome(http(500, 'INTERNAL'), t).toast).toBe('factProposal.answerError')
		expect(getAnswerErrorOutcome({ kind: 'unknown' }, t).toast).toBe('factProposal.answerError')
	})
})
