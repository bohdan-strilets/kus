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

	it('flags a reply in another language than the message', () => {
		const report = formatReplyChecks([pair('pl', 'zjadłam jajka', 'Записано, смачні яйця!')])

		expect(report).toContain('- pl: pl → uk')
	})
})
