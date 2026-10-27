import { describe, expect, it } from 'vitest'

import {
	detectLanguage,
	findGenderedForms,
	getReplyOpening,
	isNameFromText,
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

describe('detectLanguage', () => {
	it.each([
		['з’їв гречку і сік', 'uk'],
		['zjadłam dwa jajka', 'pl'],
		['съел борщ и хлеб, всё', 'ru'],
		['Вот сводка за последние 10 дней.', 'ru'],
	] as const)('%s → %s', (text, language) => {
		expect(detectLanguage(text)).toBe(language)
	})

	it.each([
		'гречка 200',
		'kebab 400 g',
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
