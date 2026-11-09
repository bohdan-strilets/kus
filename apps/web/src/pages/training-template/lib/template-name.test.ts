import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { makeDraft } from './fixtures'
import { hasDraftChanges } from './template-draft'
import {
	createTemplateNameSchema,
	isTemplateNameCounterShown,
	resolveTemplateName,
} from './template-name'

const t = ((key: string, options?: { max?: number }) =>
	`${key}:${String(options?.max ?? '')}`) as unknown as TFunction

const LONG_OLD_NAME = 'Груди, плечі й трицепс — важкий день, а ще трохи кардіо'

describe('createTemplateNameSchema', () => {
	const schema = createTemplateNameSchema(t)

	it('accepts a name of 40 characters and trims it', () => {
		expect(schema.safeParse({ name: `  ${'а'.repeat(40)}  ` }).success).toBe(true)
		expect(schema.parse({ name: '  Верх тіла ' }).name).toBe('Верх тіла')
	})

	it('names the limit when the name is longer than 40', () => {
		const result = schema.safeParse({ name: 'а'.repeat(41) })
		expect(result.success).toBe(false)
		expect(result.error?.issues[0]?.message).toBe('program.editor.nameTooLong:40')
	})

	it('lets an empty name through: the screen turns it into the default one', () => {
		expect(schema.safeParse({ name: '' }).success).toBe(true)
	})
})

describe('resolveTemplateName', () => {
	it('keeps an untouched name, even a long one', () => {
		expect(
			resolveTemplateName({ typed: LONG_OLD_NAME, saved: LONG_OLD_NAME, position: 0 }),
		).toEqual({
			status: 'unchanged',
		})
		expect(resolveTemplateName({ typed: ' Верх тіла ', saved: 'Верх тіла', position: 0 })).toEqual({
			status: 'unchanged',
		})
	})

	it('refuses a changed name over 40 characters', () => {
		expect(
			resolveTemplateName({ typed: `${LONG_OLD_NAME}!`, saved: LONG_OLD_NAME, position: 0 }),
		).toEqual({ status: 'invalid' })
	})

	it('turns an empty name into the default one of the position', () => {
		expect(resolveTemplateName({ typed: '   ', saved: 'Верх тіла', position: 1 })).toEqual({
			status: 'rename',
			name: 'Тренування Б',
		})
		expect(resolveTemplateName({ typed: '', saved: 'Тренування Б', position: 1 })).toEqual({
			status: 'unchanged',
		})
	})

	it('renames to the trimmed text', () => {
		expect(
			resolveTemplateName({ typed: ' Ноги й спина ', saved: 'Тренування Б', position: 1 }),
		).toEqual({ status: 'rename', name: 'Ноги й спина' })
	})
})

describe('isTemplateNameCounterShown', () => {
	it('wakes up from the 30th character', () => {
		expect(isTemplateNameCounterShown('а'.repeat(29))).toBe(false)
		expect(isTemplateNameCounterShown('а'.repeat(30))).toBe(true)
	})
})

describe('hasDraftChanges with a name', () => {
	const exercises = [makeDraft('a')]

	it('counts a rename alone as a change', () => {
		expect(hasDraftChanges(exercises, exercises)).toBe(false)
		expect(hasDraftChanges(exercises, exercises, 'Верх тіла')).toBe(true)
	})
})
