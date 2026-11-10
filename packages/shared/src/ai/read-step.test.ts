import { describe, expect, it } from 'vitest'

import {
	buildReadStepMessages,
	type ModelToolCall,
	splitToolCalls,
	withUserCacheBreakpoint,
} from './read-step.js'
import { READ_NOT_EXECUTED_RESULT, WRITE_NOT_EXECUTED_RESULT } from './read-tools.js'
import type { AiCompletion } from './request.js'

const call = (id: string, name: string): ModelToolCall => ({
	id,
	function: { name, arguments: '{}' },
})

const completionOf = (toolCalls: ModelToolCall[]): AiCompletion => ({
	choices: [{ message: { content: null, tool_calls: toolCalls } }],
})

describe('splitToolCalls', () => {
	it('separates reads from writes and caps the reads that run', () => {
		const reads = Array.from({ length: 6 }, (_, index) => call(`r${index}`, 'find_food'))
		const result = splitToolCalls([call('w', 'log_food'), ...reads])
		expect(result.reads.map(({ id }) => id)).toEqual(['r0', 'r1', 'r2', 'r3'])
		expect(result.skippedReads.map(({ id }) => id)).toEqual(['r4', 'r5'])
		expect(result.writes.map(({ id }) => id)).toEqual(['w'])
	})
})

describe('buildReadStepMessages', () => {
	it('answers every call id: the result of a read, a wait for a write, a limit for a skipped read', () => {
		const calls = [call('r1', 'find_food'), call('w1', 'log_food'), call('r2', 'find_food')]
		const messages = buildReadStepMessages(
			completionOf(calls),
			calls,
			new Map([['r1', { text: 'm11 "Sporty"' }]]),
		)
		expect(messages[0]).toMatchObject({
			role: 'assistant',
			tool_calls: [{ id: 'r1' }, { id: 'w1' }, { id: 'r2' }],
		})
		expect(messages.slice(1)).toEqual([
			{ role: 'tool', tool_call_id: 'r1', content: 'm11 "Sporty"' },
			{ role: 'tool', tool_call_id: 'w1', content: WRITE_NOT_EXECUTED_RESULT },
			{ role: 'tool', tool_call_id: 'r2', content: READ_NOT_EXECUTED_RESULT },
		])
	})
})

describe('withUserCacheBreakpoint', () => {
	it('marks the last user text, and only that', () => {
		const system = { role: 'system' as const, content: [{ type: 'text' as const, text: 's' }] }
		const marked = withUserCacheBreakpoint([system, { role: 'user', content: 'hello' }])
		expect(marked[0]).toEqual(system)
		expect(marked[1]).toEqual({
			role: 'user',
			content: [{ type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } }],
		})
	})

	it('leaves a message that ends in a photo alone', () => {
		const messages = [
			{
				role: 'user' as const,
				content: [{ type: 'image_url' as const, image_url: { url: 'data:image/jpeg;base64,AA' } }],
			},
		]
		expect(withUserCacheBreakpoint(messages)).toBe(messages)
	})
})
