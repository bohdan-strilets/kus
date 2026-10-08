import type { ChatMessage } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getClarificationPlacement } from './get-clarification-placement'

const entry = (id: string, kcal: number) => ({ id, kcal })

describe('getClarificationPlacement', () => {
	it('puts a question about entries of two meals under the last of them, with all their kcal', () => {
		// only the fields the placement reads
		const reply = {
			meals: [
				{ entries: [entry('eggs', 233)] },
				{ entries: [entry('soup', 150), entry('bread', 137)] },
			],
			clarifications: [{ id: 'q1', entryIds: ['eggs', 'soup'] }],
		} as unknown as Pick<ChatMessage, 'meals' | 'clarifications'>

		expect(getClarificationPlacement(reply).get('q1')).toEqual({
			lastEntryId: 'soup',
			loggedKcal: 383,
		})
	})
})
