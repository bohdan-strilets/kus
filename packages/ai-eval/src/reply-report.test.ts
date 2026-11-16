import { describe, expect, it } from 'vitest'

import type { EvalCase } from './cases/index.js'
import type { CaseResult, LoggedItem } from './eval.types.js'
import { formatReplyChecks } from './reply-report.js'

const item = (name: string): LoggedItem => ({ name, memoryRef: null, copyRef: null }) as LoggedItem

const pair = (id: string, text: string, replyText: string, items: LoggedItem[] = []) => ({
	evalCase: { id, text, expect: { decision: 'log' }, reference: 'r' } as EvalCase,
	result: { replyText, items, outputTokens: 100 } as CaseResult,
})

describe('formatReplyChecks', () => {
	it('lists gendered replies and twisted names of repo cases', () => {
		const report = formatReplyChecks([
			pair('dinner', 'йогурт, сливи, огірок', 'Вечерю ти вже записав.', [item('Слизу')]),
		])

		expect(report).toContain('Стать користувача в reply (ціль 0): 1 з 1')
		expect(report).toContain('- dinner: ти … записав')
		expect(report).toContain('Назви не зі слів користувача: 1 з 1')
		expect(report).toContain('- dinner: Слизу')
	})

	it('counts private cases without printing their names or replies', () => {
		const report = formatReplyChecks([
			pair('private:week-1', 'сливи', 'Ти поїла сливи.', [item('Слизу')]),
		])

		expect(report).toContain('- приватних: 1')
		expect(report).not.toContain('Слизу')
		expect(report).not.toContain('поїла')
	})

	it('lists judging words and markup violations next to the gender check', () => {
		const report = formatReplyChecks([
			pair('judge', 'вчора піца', 'Не зрив, це нормально 🙂'),
			pair('clean', 'вчора піца', 'Записав піцу за вчора.'),
		])

		expect(report).toContain('Оцінні слова в reply (ціль 0): 1 з 2')
		expect(report).toContain('- judge: зрив')
		expect(report).toContain('Порушення розмітки в reply (ціль 0): 1 з 2')
		expect(report).toContain('- judge: emoji-in-short')
	})

	it('flags a reply in another language than the message', () => {
		const report = formatReplyChecks([pair('pl', 'zjadłam jajka', 'Записано, смачні яйця!')])

		expect(report).toContain('- pl: pl → uk')
	})

	describe('names from the history', () => {
		const withHistory = (context: EvalCase['context']) => ({
			...pair('hist', 'ще таке саме', 'Записав.', [item('Сливи')]),
			evalCase: {
				id: 'hist',
				text: 'ще таке саме',
				expect: { decision: 'log' },
				reference: 'r',
				context,
			} as EvalCase,
		})

		it('does not flag a name the user wrote earlier in the day', () => {
			const report = formatReplyChecks([
				withHistory({ history: [{ role: 'user', content: 'на сніданок сливи' }] }),
			])

			expect(report).toContain('Назви не зі слів користувача: 0 з 1')
		})

		it('does not flag a name from the end of the day before', () => {
			const report = formatReplyChecks([
				withHistory({ previousDayHistory: [{ role: 'user', content: 'вчора сливи' }] }),
			])

			expect(report).toContain('Назви не зі слів користувача: 0 з 1')
		})

		it('still flags a name only Kusik used in its own reply of the history', () => {
			const report = formatReplyChecks([
				withHistory({ history: [{ role: 'assistant', content: 'Записав сливи' }] }),
			])

			expect(report).toContain('Назви не зі слів користувача: 1 з 1')
			expect(report).toContain('- hist: Сливи')
		})

		it('flags it as before without a history', () => {
			const report = formatReplyChecks([withHistory(undefined)])

			expect(report).toContain('Назви не зі слів користувача: 1 з 1')
		})
	})
})
