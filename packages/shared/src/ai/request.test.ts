import { describe, expect, it } from 'vitest'

import { createFoodParseRequest, isOutputTruncated } from './request.js'

const completion = (finishReason: string | null) => ({
	choices: [{ message: { content: null, tool_calls: [] }, finish_reason: finishReason }],
})

describe('createFoodParseRequest', () => {
	it('leaves room for a whole day of food', () => {
		expect(createFoodParseRequest('m', []).max_tokens).toBe(8000)
	})

	it('sends the chosen reasoning mode', () => {
		expect(createFoodParseRequest('m', [], { reasoning: 'minimal' }).reasoning).toEqual({
			effort: 'minimal',
		})
		expect(createFoodParseRequest('m', [], { reasoning: 'low' }).reasoning).toEqual({
			effort: 'low',
		})
	})
})

describe('isOutputTruncated', () => {
	it('is true only when the answer hit max_tokens', () => {
		expect(isOutputTruncated(completion('length'))).toBe(true)
		expect(isOutputTruncated(completion('tool_calls'))).toBe(false)
		expect(isOutputTruncated(completion(null))).toBe(false)
	})
})
