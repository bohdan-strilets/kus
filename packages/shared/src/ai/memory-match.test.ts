import { describe, expect, it } from 'vitest'

import { MEMORY_PASSIVE_MAX_FOODS } from './context.js'
import { findMentionedFoods, isFoodMentioned, normalizeName } from './memory-match.js'

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

const buckwheat = { nameNormalized: 'гречка варена', aliases: ['гречка'] }
const bar = { nameNormalized: 'протеїновий батончик olimp', aliases: ['олімп'] }

describe('isFoodMentioned', () => {
	it('matches an alias with a different ending', () => {
		expect(isFoodMentioned(buckwheat, '100 г гречки')).toBe(true)
	})

	it('matches a multi-word name in any order', () => {
		expect(isFoodMentioned(bar, 'батончик протеїновий Olimp після тренування')).toBe(true)
	})

	it('matches an alias regardless of case', () => {
		expect(isFoodMentioned(bar, 'з’їв ОЛІМП')).toBe(true)
	})

	it('does not match unrelated text', () => {
		expect(isFoodMentioned(buckwheat, '3 яйця і кава')).toBe(false)
	})

	it('ignores words shorter than 3 letters in the name', () => {
		expect(isFoodMentioned({ nameNormalized: 'чай з м', aliases: [] }, 'з м')).toBe(false)
	})
})

describe('isFoodMentioned: Latin look-alikes', () => {
	it('matches an old memory name with a Latin look-alike against a clean message', () => {
		const food = { nameNormalized: dirtyName, aliases: [] }
		expect(isFoodMentioned(food, `${SKUSHAV} ${cleanName} ${GRAMS}`)).toBe(true)
	})

	it('matches a clean memory name against a message with a look-alike', () => {
		const food = { nameNormalized: cleanName, aliases: [] }
		expect(isFoodMentioned(food, `${SKUSHAV} ${dirtyName} ${GRAMS}`)).toBe(true)
	})

	it('matches an alias with a look-alike', () => {
		const food = { nameNormalized: cp('43d 435 43c 43e'), aliases: [dirtyName] }
		expect(isFoodMentioned(food, cleanName)).toBe(true)
	})

	it('matches an uppercase message against a dirty name', () => {
		const food = { nameNormalized: dirtyName, aliases: [] }
		expect(isFoodMentioned(food, cleanName.toUpperCase())).toBe(true)
	})

	it('does not match another product', () => {
		const food = { nameNormalized: dirtyName, aliases: [] }
		const other = `${cp('433 440 435 447 43a 430')} ${GRAMS}` // гречка 200 г
		expect(isFoodMentioned(food, other)).toBe(false)
	})

	it('does not match when only part of the name is mentioned', () => {
		const food = { nameNormalized: dirtyName, aliases: [] }
		expect(isFoodMentioned(food, `${KURYACH + cp('430')} ${cp('441 443 43f')}`)).toBe(false)
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
