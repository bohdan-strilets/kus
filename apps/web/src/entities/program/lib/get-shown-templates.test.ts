import type { ProgramTemplateDraft } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getShownTemplates } from './get-shown-templates'

const KEY_A = '0199b3a4-0000-7000-8000-00000000000a'
const KEY_B = '0199b3a4-0000-7000-8000-00000000000b'

const makeTemplate = (key: string): ProgramTemplateDraft => ({
	key,
	name: key,
	weekdays: [],
	estimatedMin: 55,
	exercises: [],
})

const templates = [makeTemplate(KEY_A), makeTemplate(KEY_B)]

describe('getShownTemplates', () => {
	it('shows only the pinned template in SINGLE', () => {
		const result = getShownTemplates({ mode: 'SINGLE', pinnedKey: KEY_B, templates })
		expect(result.templates.map((template) => template.key)).toEqual([KEY_B])
		expect(result.otherCount).toBe(1)
	})

	it('shows everything in SINGLE without a matching pin', () => {
		for (const pinnedKey of [null, '0199b3a4-0000-7000-8000-0000000000ff']) {
			const result = getShownTemplates({ mode: 'SINGLE', pinnedKey, templates })
			expect(result.templates).toBe(templates)
			expect(result.otherCount).toBe(0)
		}
	})

	it('shows everything in ROTATE even with a pinnedKey', () => {
		const result = getShownTemplates({ mode: 'ROTATE', pinnedKey: KEY_A, templates })
		expect(result.templates).toBe(templates)
		expect(result.otherCount).toBe(0)
	})
})
