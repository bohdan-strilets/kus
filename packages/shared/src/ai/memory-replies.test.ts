import { describe, expect, it } from 'vitest'

import { FACTS_MAX } from '../schemas/facts.js'
import {
	applyMemoryNotice,
	FACT_BODY_REPLY,
	FACT_HEALTH_REPLY,
	FACT_NOT_SAVED_REPLY,
	FACT_TOO_LONG_REPLY,
	FACTS_LIMIT_NOTICE,
	FACTS_LIMIT_REPLY,
	getRejectedFactNotice,
	type MemoryNotice,
} from './memory-replies.js'

const loud = (text: string): MemoryNotice => ({ text, isQuietUnlessClaimed: false })

const LOUD_NOTICES = [
	['limit', FACTS_LIMIT_NOTICE],
	['health', getRejectedFactNotice('HEALTH_DATA')],
	['body', getRejectedFactNotice('BODY_DATA')],
] as const

const QUIET_NOTICES = [
	['too long', getRejectedFactNotice('TOO_LONG'), FACT_TOO_LONG_REPLY],
	['empty', getRejectedFactNotice('EMPTY'), FACT_NOT_SAVED_REPLY],
	['instruction', getRejectedFactNotice('INSTRUCTION'), FACT_NOT_SAVED_REPLY],
] as const

describe('memory notices', () => {
	it('keep the author wording', () => {
		expect(FACTS_LIMIT_REPLY).toBe(
			"У пам'яті вже 30 фактів — щоб додати новий, прибери якийсь у «Пам'яті».",
		)
		expect(FACT_HEALTH_REPLY).toBe("Дані про здоров'я я не зберігаю — лише те, чого ти не їси.")
		expect(FACT_BODY_REPLY).toBe('Вагу й заміри записую окремо, а не як факт.')
		expect(FACT_TOO_LONG_REPLY).toBe("Це задовго для пам'яті — скажи одним коротким реченням.")
		expect(FACT_NOT_SAVED_REPLY).toBe("Цього я не запам'ятав.")
	})

	it('takes the limit from FACTS_MAX', () => {
		expect(FACTS_LIMIT_REPLY).toContain(`вже ${FACTS_MAX} фактів`)
	})
})

describe('applyMemoryNotice', () => {
	it.each(LOUD_NOTICES)('replaces a reply that claims it remembered — %s', (_name, notice) => {
		expect(applyMemoryNotice("Запам'ятав: не їси рибу.", notice)).toBe(notice.text)
	})

	it.each(LOUD_NOTICES)(
		'adds the notice as a separate sentence otherwise — %s',
		(_name, notice) => {
			expect(applyMemoryNotice('Добре, зрозумів.', notice)).toBe(`Добре, зрозумів. ${notice.text}`)
		},
	)

	it.each(QUIET_NOTICES)(
		"replaces a false «запам'ятав» for a silently refused fact — %s",
		(_name, notice, text) => {
			expect(applyMemoryNotice("Запам'ятав, що ти працюєш змінами.", notice)).toBe(text)
		},
	)

	it.each(QUIET_NOTICES)('stays silent when the model promised nothing — %s', (_name, notice) => {
		expect(applyMemoryNotice('Добре, зрозумів.', notice)).toBe('Добре, зрозумів.')
	})

	it.each(["Запам'ятав", 'Запам’ятав', 'Запамʼятав', "запам'ятав це", 'ЗАПАМ’ЯТАВ'])(
		'recognises %s as a claim',
		(text) => {
			expect(applyMemoryNotice(text, loud(FACT_BODY_REPLY))).toBe(FACT_BODY_REPLY)
		},
	)

	it('does not take a question about remembering for a claim', () => {
		expect(applyMemoryNotice("Запам'ятати?", loud(FACT_BODY_REPLY))).toBe(
			`Запам'ятати? ${FACT_BODY_REPLY}`,
		)
	})

	it('is just the notice for an empty reply', () => {
		expect(applyMemoryNotice('  ', loud(FACT_BODY_REPLY))).toBe(FACT_BODY_REPLY)
	})
})
