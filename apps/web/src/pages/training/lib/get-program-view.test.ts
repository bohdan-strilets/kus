import type { ProgramResponse } from '@kus/shared'
import { describe, expect, it } from 'vitest'

import { getNextTemplate } from './get-program-view'

const A = '0199b3a4-0000-7000-8000-0000000000a0'
const B = '0199b3a4-0000-7000-8000-0000000000b0'

const makeProgram = (next: ProgramResponse['next']): ProgramResponse =>
	({
		templates: [
			{ id: A, name: 'Тренування А' },
			{ id: B, name: 'Тренування Б' },
		],
		next,
	}) as ProgramResponse

describe('getNextTemplate', () => {
	it('finds the template the program points at', () => {
		const next = { templateId: B, weekday: null, date: null, isToday: false }

		expect(getNextTemplate(makeProgram(next))?.name).toBe('Тренування Б')
	})

	it('is null without a pointer or when it names no template', () => {
		const stale = {
			templateId: '0199b3a4-0000-7000-8000-0000000000c0',
			weekday: null,
			date: null,
			isToday: false,
		}

		expect(getNextTemplate(makeProgram(null))).toBeNull()
		expect(getNextTemplate(makeProgram(stale))).toBeNull()
	})
})
