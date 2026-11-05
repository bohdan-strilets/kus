import { describe, expect, it } from 'vitest'

import {
	detectLanguage,
	findGenderedForms,
	getReplyOpening,
	isNameFromText,
	findJudgingWords,
	findMarkupViolations,
} from './reply-checks.js'

describe('findGenderedForms', () => {
	it.each([
		['Вечерю ти вже записав, усе на місці.', 'ти … записав'],
		['Ти сьогодні добре поїла!', 'ти … поїла'],
		['Ти зважився вчора?', 'ти … зважився'],
		['Ти голодна після залу?', 'ти … голодна'],
		['Ты съел много сладкого', 'ты … съел'],
		['Zjadłeś dziś dwa jajka', 'zjadłeś'],
		['Ти записав(-ла) все', 'записав(-ла)'],
	])('flags %s', (reply, form) => {
		expect(findGenderedForms(reply)).toContain(form)
	})

	it.each([
		'Записав вечерю, 520 ккал.',
		'Я записав, а ти можеш додати фото.',
		'Ти можеш з’їсти ще трохи білка.',
		'Ти сьогодні в нормі, так тримати.',
		'Записано: йогурт і сливи.',
		'Що ти хочеш на вечерю?',
		'Ти на дієті? Тоді обери легше.',
	])('does not flag %s', (reply) => {
		expect(findGenderedForms(reply)).toEqual([])
	})
})

describe('findGenderedForms by the address form of the user', () => {
	it('with masculine, «ти записав» is right and «ти записала» is a mistake', () => {
		expect(findGenderedForms('Вечерю ти вже записав.', 'MASCULINE')).toEqual([])
		expect(findGenderedForms('Ти вже записала вечерю.', 'MASCULINE')).toEqual(['ти … записала'])
	})

	it('with feminine, «ти записала» is right and «ти записав» is a mistake', () => {
		expect(findGenderedForms('Ти вже записала вечерю.', 'FEMININE')).toEqual([])
		expect(findGenderedForms('Вечерю ти вже записав.', 'FEMININE')).toEqual(['ти … записав'])
	})

	it('knows the gender of Polish forms and of short adjectives', () => {
		expect(findGenderedForms('Zjadłeś dziś dwa jajka', 'MASCULINE')).toEqual([])
		expect(findGenderedForms('Zjadłaś dziś dwa jajka', 'MASCULINE')).toEqual(['zjadłaś'])
		expect(findGenderedForms('Ти голодна після залу?', 'FEMININE')).toEqual([])
		expect(findGenderedForms('Ти голодний після залу?', 'FEMININE')).toEqual(['ти … голодний'])
	})

	it('flags a double form for every choice, and any form for neutral', () => {
		expect(findGenderedForms('Ти записав(-ла) усе', 'MASCULINE')).toContain('записав(-ла)')
		expect(findGenderedForms('Ти записала усе', 'NEUTRAL')).toEqual(['ти … записала'])
		expect(findGenderedForms('Ти записав усе')).toEqual(['ти … записав'])
	})

	it('never flags Kusik speaking about himself, whatever the form', () => {
		for (const form of ['NEUTRAL', 'MASCULINE', 'FEMININE'] as const) {
			expect(findGenderedForms('Я записав, а ти можеш додати фото.', form)).toEqual([])
		}
	})
})

describe('detectLanguage', () => {
	it.each([
		['з’їв гречку і сік', 'uk'],
		['zjadłam dwa jajka', 'pl'],
		['съел борщ и хлеб, всё', 'ru'],
		['Вот сводка за последние 10 дней.', 'ru'],
		['Zapisane: owsianka na mleku i banan. Smacznego!', 'pl'],
		['nie wiem ile to ma kalorii', 'pl'],
	] as const)('%s → %s', (text, language) => {
		expect(detectLanguage(text)).toBe(language)
	})

	it.each([
		'гречка 200',
		'kebab 400 g',
		'kebab with fries, 400 kcal',
		'зjadłam і съел',
		'Записав вечерю, усе добре',
		'чи можна jeść jajka codziennie?',
	])('%s → null', (text) => {
		expect(detectLanguage(text)).toBeNull()
	})
})

describe('isNameFromText', () => {
	const text = 'йогурт, сливи, огірок, 2 яйця, гречку і 150 г рибних крилець'

	it.each([
		'Йогурт грецький',
		'Сливи',
		'Огірки свіжі',
		'Яйце куряче',
		'Гречка варена',
		'Рибні крильця',
	])('%s comes from the text', (name) => {
		expect(isNameFromText(name, text)).toBe(true)
	})

	it('flags a twisted name', () => {
		expect(isNameFromText('Слизу', text)).toBe(false)
	})
})

describe('getReplyOpening', () => {
	it('takes the first three words in lower case', () => {
		expect(getReplyOpening('Ось твій місяць. Тримай!')).toBe('ось твій місяць')
	})
})

describe('findGenderedForms: double forms in neutral', () => {
	it('reports «(-а)» and «(-ла)» endings', () => {
		expect(findGenderedForms('Ти вже поїв(-ла)?')).toContain('поїв(-ла)')
		expect(findGenderedForms('Готовий(-а) до тренування?')).toContain('готовий(-а)')
		expect(findGenderedForms('Ти поїв(ла) вже?')).toContain('поїв(ла)')
	})
})

describe('findJudgingWords', () => {
	it('flags "погано" only as a whole word', () => {
		expect(findJudgingWords('Це погано.')).toEqual(['погано'])
		expect(findJudgingWords('Непогано для вечері')).toEqual([])
	})

	it('matches the stems by the beginning of a word, in any case', () => {
		expect(findJudgingWords('Ти зірвався?')).toEqual(['зірвався'])
		expect(findJudgingWords('Зриви бувають')).toEqual(['зриви'])
		expect(findJudgingWords('Треба відпрацювати')).toEqual(['відпрацювати'])
		expect(
			findJudgingWords('Чіт-міл і гріх, шкідливе, заборонене, провал, компенсуй'),
		).toHaveLength(6)
	})

	it('does not flag plain wording and returns each word once', () => {
		expect(findJudgingWords('Записав піцу, чипси й тортик за вчора.')).toEqual([])
		expect(findJudgingWords('зрив, зрив')).toEqual(['зрив'])
	})
})

describe('findMarkupViolations', () => {
	const LONG = 'Перший рядок.\n\nДругий рядок.\n\nТретій рядок.'

	it('accepts a clean short reply and a clean longer one', () => {
		expect(findMarkupViolations('Записав: **420 ккал**.')).toEqual([])
		expect(
			findMarkupViolations(
				'Ось що можна спробувати.\n\n### Що змінити\n\n1. Більше сну\n2. Піднімати на **2,5 кг** більше',
			),
		).toEqual([])
	})

	it('flags a table, a link and backticks', () => {
		expect(findMarkupViolations(`${LONG}\n| а | б |`)).toContain('table')
		expect(findMarkupViolations(`${LONG}\n[тут](https://x.y)`)).toContain('link')
		expect(findMarkupViolations(`${LONG}\n\`код\``)).toContain('code')
	})

	it('flags a nested list item', () => {
		expect(findMarkupViolations(`${LONG}\n- один\n  - вкладений`)).toContain('nested-list')
		expect(findMarkupViolations(`${LONG}\n- один\n- два`)).not.toContain('nested-list')
	})

	it('flags a heading over 4 words only', () => {
		expect(findMarkupViolations(`${LONG}\n### Що змінити у плані тренувань`)).toContain(
			'long-heading',
		)
		expect(findMarkupViolations(`${LONG}\n### Що змінити далі`)).not.toContain('long-heading')
	})

	it('flags headings and lists in a reply of 1–2 lines', () => {
		expect(findMarkupViolations('### Порада\nСпи більше')).toContain('block-in-short')
		expect(findMarkupViolations('- сон\n- вода')).toContain('block-in-short')
		expect(findMarkupViolations('Так.\n\n- сон\n- вода\n- крок')).not.toContain('block-in-short')
	})

	it('flags more than 2 emoji, and any emoji in a short reply', () => {
		expect(findMarkupViolations(`${LONG} 🙂🙂🙂`)).toContain('many-emoji')
		expect(findMarkupViolations(`${LONG} 🙂`)).toEqual([])
		expect(findMarkupViolations('Записав 🙂')).toEqual(['emoji-in-short'])
	})
})
