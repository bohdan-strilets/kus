import { buildStatsAdviceToolResultFromNumbers, type RawToolCall } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { BASE_CONTEXT } from './run-case.js'
import {
	buildStatsFollowUpMessages,
	findStatsCall,
	getStatsFollowUpText,
} from './stats-follow-up.js'

const NUMBERS = '7 days 2026-10-01–2026-10-07: logged 6 of 7 days; average 2 160 kcal'
const STATS_CALL: RawToolCall = {
	name: 'show_stats',
	arguments: JSON.stringify({ days: 7, advice: true, reply: 'Ось тиждень.' }),
}

const completion = (calls: RawToolCall[]) => ({
	choices: [
		{
			finish_reason: 'tool_calls',
			message: {
				role: 'assistant' as const,
				content: null,
				tool_calls: calls.map((call, index) => ({
					id: `c${index}`,
					type: 'function' as const,
					function: call,
				})),
			},
		},
	],
})

describe('buildStatsFollowUpMessages', () => {
	it('ends with the model show_stats call and the counted numbers', () => {
		const messages = buildStatsFollowUpMessages(
			BASE_CONTEXT,
			'підсумок і поради',
			STATS_CALL,
			NUMBERS,
		)
		const [assistant, tool] = messages.slice(-2)
		expect(assistant).toMatchObject({
			role: 'assistant',
			tool_calls: [{ function: STATS_CALL }],
		})
		expect(tool).toMatchObject({
			role: 'tool',
			content: buildStatsAdviceToolResultFromNumbers(NUMBERS),
		})
		expect(tool && 'content' in tool && tool.content).toContain(NUMBERS)
	})
})

describe('findStatsCall', () => {
	it('finds show_stats among the calls', () => {
		expect(findStatsCall([{ name: 'reply', arguments: '{}' }, STATS_CALL])).toBe(STATS_CALL)
		expect(findStatsCall([])).toBeUndefined()
	})
})

describe('getStatsFollowUpText', () => {
	it('takes the text of a lone reply', () => {
		const reply = { name: 'reply', arguments: JSON.stringify({ text: 'Білка трохи бракує.' }) }
		expect(getStatsFollowUpText(completion([reply]) as never, BASE_CONTEXT)).toBe(
			'Білка трохи бракує.',
		)
	})

	it('takes nothing from another tool or a reply with a card', () => {
		expect(getStatsFollowUpText(completion([STATS_CALL]) as never, BASE_CONTEXT)).toBeNull()
		const withCard = {
			name: 'reply',
			arguments: JSON.stringify({ text: 'Ось.', attach: 'program' }),
		}
		expect(getStatsFollowUpText(completion([withCard]) as never, BASE_CONTEXT)).toBeNull()
	})
})
