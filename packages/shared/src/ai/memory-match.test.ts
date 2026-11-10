import { describe, expect, it } from 'vitest'

import { MEMORY_PASSIVE_MAX_FOODS } from './context.js'
import { findMentionedFoods, normalizeName } from './memory-match.js'

// Latin look-alikes are built from code points: literal glyphs could be swapped by an editor.
const cp = (codes: string): string =>
	String.fromCodePoint(...codes.split(' ').map((code) => Number.parseInt(code, 16)))
const LAT_P = cp('70')
const KURYACH = cp('43a 443 440 44f 447') // куряч
const GRUDKA = cp('433 440 443 434 43a 430') // грудка
const cleanName = `${KURYACH + cp('430')} ${GRUDKA}` // куряча грудка (all Cyrillic)
const dirtyName = `${cp('43a 443')}${LAT_P}${cp('44f 447 430')} ${GRUDKA}` // ку(Latin p)яча грудка — inside the stem
const SKUSHAV = cp('437 457 432') // зїв
const GRAMS = '200 ' + cp('433') // 200 г

describe('findMentionedFoods: Latin look-alikes', () => {
	const NOW = new Date('2026-11-10T12:00:00Z')
	const find = (name: string, text: string): number =>
		findMentionedFoods(text, [{ name }], { now: NOW }).length

	it('finds an old memory name with a Latin look-alike by a clean message', () => {
		expect(find(dirtyName, `${SKUSHAV} ${cleanName} ${GRAMS}`)).toBe(1)
	})

	it('finds a clean memory name by a message with a look-alike', () => {
		expect(find(cleanName, `${SKUSHAV} ${dirtyName} ${GRAMS}`)).toBe(1)
	})

	it('finds a name by an alias with a look-alike', () => {
		const food = { name: cp('43d 435 43c 43e'), aliases: [dirtyName] }
		expect(findMentionedFoods(cleanName, [food], { now: NOW })).toHaveLength(1)
	})

	it('finds a dirty name by an uppercase message', () => {
		expect(find(dirtyName, cleanName.toUpperCase())).toBe(1)
	})

	it('does not find another product', () => {
		expect(find(dirtyName, `${cp('433 440 435 447 43a 430')} ${GRAMS}`)).toBe(0) // гречка 200 г
	})
})

describe('normalizeName', () => {
	it('lowercases, trims and collapses spaces', () => {
		expect(normalizeName('  Борщ   Червоний ')).toBe('борщ червоний')
	})

	it('keeps a Latin look-alike: the stored nameNormalized is not rewritten', () => {
		const result = normalizeName(`  ${dirtyName.toUpperCase()} `)
		expect(result).toBe(dirtyName)
		expect(result).not.toBe(cleanName)
		expect(result.codePointAt(2)).toBe(0x70)
	})
})

describe('findMentionedFoods', () => {
	const NOW = new Date('2026-11-10T12:00:00Z')
	const pool = [
		{ name: 'Молоко 2%', aliases: [] as string[] },
		{ name: 'Батончик SportyFeel', aliases: [] as string[] },
		{ name: 'Протеїновий батончик', aliases: [] as string[] },
		{ name: 'Гречка', aliases: [] as string[] },
		{ name: 'Йогурт', aliases: [] as string[] },
	]
	const find = (text: string): string[] =>
		findMentionedFoods(text, pool, { now: NOW }).map((food) => food.name)

	it('ignores verbs and amounts around the food', () => {
		expect(find('Додай молоко 400г')).toEqual(['Молоко 2%'])
	})

	it('finds a food by the word that is in the name, with an inflected ending', () => {
		expect(find('Додай гречку')).toEqual(['Гречка'])
	})

	it('finds the food by an abbreviated prefix, covering the whole query', () => {
		expect(find('прот батончик')).toEqual(['Протеїновий батончик'])
	})

	it('finds a Latin name written in Latin and in Cyrillic', () => {
		expect(find('Sportyfeel')).toEqual(['Батончик SportyFeel'])
		expect(find('спортифил')).toEqual(['Батончик SportyFeel'])
	})

	it('finds each food of a message with several foods', () => {
		expect(find('молоко і гречка, йогурт')).toEqual(['Молоко 2%', 'Гречка', 'Йогурт'])
	})

	it('finds nothing for a message that names no saved food', () => {
		expect(find('Додай банан 100г')).toEqual([])
		expect(find('привіт')).toEqual([])
	})

	it('does not match a one-letter word of a name against any word starting with it', () => {
		const tea = [{ name: 'Чай з молоком', aliases: [] as string[] }]
		expect(findMentionedFoods('Додай зефір 100г', tea, { now: NOW })).toEqual([])
	})

	it('keeps the order of the given foods and caps the count', () => {
		const many = Array.from({ length: 8 }, (_, index) => ({
			name: `Йогурт ${index}`,
			aliases: [] as string[],
		}))
		const found = findMentionedFoods('йогурт', many, { now: NOW })
		expect(found).toHaveLength(MEMORY_PASSIVE_MAX_FOODS)
		expect(found.map(({ name }) => name)).toEqual([...found.map(({ name }) => name)].sort())
	})
})
