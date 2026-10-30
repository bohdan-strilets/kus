import { describe, expect, it } from 'vitest'

import {
	applyMemoryNotice,
	FACT_BODY_REPLY,
	FACT_HEALTH_REPLY,
	FACTS_LIMIT_REPLY,
	getRejectedFactNotice,
} from './memory-replies.js'

const NOTICES = [
	['limit', FACTS_LIMIT_REPLY],
	['health', FACT_HEALTH_REPLY],
	['body', FACT_BODY_REPLY],
] as const

describe('memory notices', () => {
	it('keep the author wording', () => {
		expect(FACTS_LIMIT_REPLY).toBe(
			"У пам'яті вже 30 фактів — щоб додати новий, прибери якийсь у «Пам'яті».",
		)
		expect(FACT_HEALTH_REPLY).toBe("Дані про здоров'я я не зберігаю — лише те, чого ти не їси.")
		expect(FACT_BODY_REPLY).toBe('Вагу й заміри записую окремо, а не як факт.')
	})
})

describe('applyMemoryNotice', () => {
	it.each(NOTICES)('replaces a reply that claims it remembered — %s', (_name, notice) => {
		expect(applyMemoryNotice("Запам'ятав: не їси рибу.", notice)).toBe(notice)
	})

	it.each(NOTICES)('adds the notice as a separate sentence otherwise — %s', (_name, notice) => {
		expect(applyMemoryNotice('Добре, зрозумів.', notice)).toBe(`Добре, зрозумів. ${notice}`)
	})

	it.each(["Запам'ятав", 'Запам’ятав', 'Запамʼятав', "запам'ятав це", 'ЗАПАМ’ЯТАВ'])(
		'recognises %s as a claim',
		(text) => {
			expect(applyMemoryNotice(text, FACT_BODY_REPLY)).toBe(FACT_BODY_REPLY)
		},
	)

	it('does not take a question about remembering for a claim', () => {
		expect(applyMemoryNotice("Запам'ятати?", FACT_BODY_REPLY)).toBe(
			`Запам'ятати? ${FACT_BODY_REPLY}`,
		)
	})

	it('is just the notice for an empty reply', () => {
		expect(applyMemoryNotice('  ', FACT_BODY_REPLY)).toBe(FACT_BODY_REPLY)
	})
})

describe('getRejectedFactNotice', () => {
	it('maps the guard issues to their sentence', () => {
		expect(getRejectedFactNotice('HEALTH_DATA')).toBe(FACT_HEALTH_REPLY)
		expect(getRejectedFactNotice('BODY_DATA')).toBe(FACT_BODY_REPLY)
	})

	it('says nothing about an instruction, an empty or a too long text', () => {
		expect(getRejectedFactNotice('INSTRUCTION')).toBeNull()
		expect(getRejectedFactNotice('EMPTY')).toBeNull()
		expect(getRejectedFactNotice('TOO_LONG')).toBeNull()
	})
})
