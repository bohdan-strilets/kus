import { describe, expect, it } from 'vitest'

import { saveTemplateRequestSchema } from './programs-api.js'
import {
	getDefaultTemplateName,
	PROGRAM_NAME_MAX_LENGTH,
	PROGRAM_TEMPLATE_NAME_COUNTER_FROM,
	PROGRAM_TEMPLATE_NAME_UI_MAX,
	PROGRAM_TEMPLATES_MAX,
	TEMPLATE_NAME_LETTERS,
} from './programs.js'

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('default template names', () => {
	it('has a letter for every template the program can hold, each once', () => {
		expect(TEMPLATE_NAME_LETTERS.length).toBeGreaterThanOrEqual(PROGRAM_TEMPLATES_MAX)
		expect(new Set(TEMPLATE_NAME_LETTERS).size).toBe(TEMPLATE_NAME_LETTERS.length)
	})

	it('names templates by position', () => {
		expect(getDefaultTemplateName(0)).toBe('Тренування А')
		expect(getDefaultTemplateName(6)).toBe('Тренування Ж')
	})

	it('falls back to the 1-based number past the letters and to the first one for a bad position', () => {
		expect(getDefaultTemplateName(TEMPLATE_NAME_LETTERS.length)).toBe(
			`Тренування ${TEMPLATE_NAME_LETTERS.length + 1}`,
		)
		expect(getDefaultTemplateName(-1)).toBe('Тренування А')
		expect(getDefaultTemplateName(Number.NaN)).toBe('Тренування А')
	})

	it('keeps the UI limits under the schema limit', () => {
		expect(PROGRAM_TEMPLATE_NAME_COUNTER_FROM).toBeLessThan(PROGRAM_TEMPLATE_NAME_UI_MAX)
		expect(PROGRAM_TEMPLATE_NAME_UI_MAX).toBeLessThanOrEqual(PROGRAM_NAME_MAX_LENGTH)
	})
})

describe('saveTemplateRequestSchema name', () => {
	const base = { baseVersionId: uuid(1), templateId: uuid(2), exercises: [] }

	it('accepts a missing name and trims a given one', () => {
		expect(saveTemplateRequestSchema.parse(base).name).toBeUndefined()
		expect(saveTemplateRequestSchema.parse({ ...base, name: '  Ноги  ' }).name).toBe('Ноги')
	})

	it('rejects an empty, blank or too long name', () => {
		expect(saveTemplateRequestSchema.safeParse({ ...base, name: '' }).success).toBe(false)
		expect(saveTemplateRequestSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
		expect(
			saveTemplateRequestSchema.safeParse({
				...base,
				name: 'а'.repeat(PROGRAM_NAME_MAX_LENGTH + 1),
			}).success,
		).toBe(false)
	})
})
