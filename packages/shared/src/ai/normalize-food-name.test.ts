import { describe, expect, it } from 'vitest'

import { normalizeFoodName } from './normalize-food-name.js'

// Strings are built from explicit code points (hex, space separated): a Latin "a" (0x61) and a
// Cyrillic "a" (0x430) look identical, so literal glyphs could be silently swapped by an editor,
// a formatter or a copy-paste and the test would stop testing anything.
const cp = (codes: string): string =>
	String.fromCodePoint(...codes.split(' ').map((code) => Number.parseInt(code, 16)))

const LAT_A = cp('61')
const LAT_E = cp('65')
const LAT_O = cp('6f')
const LAT_P = cp('70')
const LAT_C_UP = cp('43')
const LAT_E_UP = cp('45')
const LAT_X_UP = cp('58')
const LAT_I_UP = cp('49')

const KURYACH = cp('43a 443 440 44f 447') // куряч
const kuryacha = KURYACH + cp('430') // куряча
const kuryache = KURYACH + cp('435') // куряче
const SHT = cp('448 442') // шт
const borshch = cp('411 43e 440 449') // Борщ
const myaso = cp('43c') + "'" + cp('44f 441 43e') // м'ясо
const salad = cp('421 430 43b 430 442') // Салат
const GRUDK = cp('433 440 443 434 43a') // грудк

describe('normalizeFoodName', () => {
	it('fixes a Latin a at the end of a Cyrillic word', () => {
		expect(normalizeFoodName(KURYACH + LAT_A)).toBe(kuryacha)
	})

	it('fixes a Latin e at the end of a Cyrillic word', () => {
		expect(normalizeFoodName(KURYACH + LAT_E)).toBe(kuryache)
	})

	it('fixes look-alikes in the middle of a word and keeps digits and the rest', () => {
		const dirty = cp('411') + LAT_O + LAT_P + cp('449') + ` 2 ${SHT}`
		expect(normalizeFoodName(dirty)).toBe(`${borshch} 2 ${SHT}`)
	})

	it("fixes a word with an apostrophe: м'ясo", () => {
		const dirty = cp('43c') + "'" + cp('44f 441') + LAT_O
		expect(normalizeFoodName(dirty)).toBe(myaso)
	})

	it('fixes uppercase look-alikes', () => {
		// "СЕР": Latin C, Latin E, Cyrillic Р
		expect(normalizeFoodName(LAT_C_UP + LAT_E_UP + cp('420'))).toBe(cp('421 415 420'))
		// "ХЛІБ": Latin X, Cyrillic л, Latin I, Cyrillic Б
		expect(normalizeFoodName(LAT_X_UP + cp('43b') + LAT_I_UP + cp('411'))).toBe(
			cp('425 43b 406 411'),
		)
	})

	it('keeps a Latin brand after a hyphen: "Кока-Cola" is unchanged', () => {
		const name = cp('41a 43e 43a 430') + '-Cola'
		expect(normalizeFoodName(name)).toBe(name)
	})

	it('fixes the Cyrillic word and leaves the Latin one: "Салат Caesar"', () => {
		const dirty = cp('421 430 43b') + LAT_A + cp('442') + ' Caesar'
		expect(normalizeFoodName(dirty)).toBe(`${salad} Caesar`)
	})

	it('leaves a Latin word at the end: "куряча грудка Chicken"', () => {
		const dirty = `${KURYACH + LAT_A} ${GRUDK + LAT_A} Chicken`
		expect(normalizeFoodName(dirty)).toBe(`${kuryacha} ${GRUDK + cp('430')} Chicken`)
	})

	it.each(['Coca-Cola', 'Milka', 'KFC', 'Cheese', 'Pepsi Max', 'Oreo'])(
		'does not touch the Latin-only name %s',
		(name) => {
			expect(normalizeFoodName(name)).toBe(name)
		},
	)

	it('returns an empty string and whitespace as they are', () => {
		expect(normalizeFoodName('')).toBe('')
		expect(normalizeFoodName('   ')).toBe('   ')
	})

	it('keeps digits and hyphens: "3-в-1" and "Кап-учіно 250 мл"', () => {
		const threeInOne = '3-' + cp('432') + '-1'
		expect(normalizeFoodName(threeInOne)).toBe(threeInOne)
		const cappuccino = cp('41a 430 43f') + '-' + cp('443 447 456 43d 43e') + ' 250 ' + cp('43c 43b')
		expect(normalizeFoodName(cappuccino)).toBe(cappuccino)
	})

	it('treats hyphen parts as separate words: the Cyrillic part is fixed', () => {
		const dirty = cp('41a 430 43f') + '-' + cp('443 447 456 43d') + LAT_O
		expect(normalizeFoodName(dirty)).toBe(cp('41a 430 43f') + '-' + cp('443 447 456 43d 43e'))
	})

	it('does not change a name that is already Cyrillic', () => {
		expect(normalizeFoodName(borshch)).toBe(borshch)
		expect(normalizeFoodName(myaso)).toBe(myaso)
	})

	it('is idempotent', () => {
		const names = [
			KURYACH + LAT_A,
			cp('411') + LAT_O + LAT_P + cp('449') + ` 2 ${SHT}`,
			cp('421 430 43b') + LAT_A + cp('442') + ' Caesar',
			'Coca-Cola',
			'',
		]
		for (const name of names) {
			const once = normalizeFoodName(name)
			expect(normalizeFoodName(once)).toBe(once)
		}
	})

	it('really replaces the code point, not just an identical-looking glyph', () => {
		const result = normalizeFoodName(KURYACH + LAT_A)
		expect(result.codePointAt(result.length - 1)).toBe(0x430)
	})
})

describe('normalizeFoodName: lone letters', () => {
	const LAT_C = cp('63')
	const LAT_I = cp('69')
	const LAT_X = cp('78')
	const LAT_O_UP = cp('4f')
	const LAT_A_UP = cp('41')
	const kava = cp('43a 430 432 430') // кава
	const molokom = cp('43c 43e 43b 43e 43a 43e 43c') // молоком
	const tsukrom = cp('446 443 43a 440 43e 43c') // цукром
	const borshchLower = cp('431 43e 440 449') // борщ
	const smetana = cp('441 43c 435 442 430 43d 430') // сметана
	const vitamin = cp('412 456 442 430 43c 456 43d') // Вітамін
	const grechka = cp('433 440 435 447 43a 438') // гречки
	const G = cp('433') // г
	const CYR_S = cp('441')
	const CYR_I = cp('456')

	it('turns a lone Latin c into Cyrillic с in a Cyrillic name', () => {
		expect(normalizeFoodName(`${kava} ${LAT_C} ${molokom}`)).toBe(`${kava} ${CYR_S} ${molokom}`)
	})

	it('turns a lone Latin i into Cyrillic і', () => {
		expect(normalizeFoodName(`${borshchLower} ${LAT_I} ${smetana}`)).toBe(
			`${borshchLower} ${CYR_I} ${smetana}`,
		)
	})

	it('fixes every lone c in the name', () => {
		const dirty = `${kava} ${LAT_C} ${molokom} ${LAT_C} ${tsukrom}`
		expect(normalizeFoodName(dirty)).toBe(`${kava} ${CYR_S} ${molokom} ${CYR_S} ${tsukrom}`)
	})

	it('fixes lone o and a as well', () => {
		expect(normalizeFoodName(`${kava} ${LAT_O} ${LAT_A}`)).toBe(`${kava} ${cp('43e')} ${cp('430')}`)
	})

	it('keeps an uppercase lone letter: "Вітамін C"', () => {
		const name = `${vitamin} ${LAT_C_UP}`
		expect(normalizeFoodName(name)).toBe(name)
	})

	it('keeps uppercase lone A and O in a Cyrillic name', () => {
		const name = `${kava} ${LAT_A_UP} ${LAT_O_UP}`
		expect(normalizeFoodName(name)).toBe(name)
	})

	it('keeps a lone x and numbers: "2 x 100 г гречки"', () => {
		const name = `2 ${LAT_X} 100 ${G} ${grechka}`
		expect(normalizeFoodName(name)).toBe(name)
	})

	it.each(['coffee c milk', 'c', 'i', 'tea a cup'])(
		'does not touch a name with no Cyrillic: %s',
		(name) => {
			expect(normalizeFoodName(name)).toBe(name)
		},
	)

	it('is idempotent on the lone-letter cases', () => {
		const names = [
			`${kava} ${LAT_C} ${molokom}`,
			`${borshchLower} ${LAT_I} ${smetana}`,
			`${vitamin} ${LAT_C_UP}`,
			`2 ${LAT_X} 100 ${G} ${grechka}`,
			'coffee c milk',
		]
		for (const name of names) {
			const once = normalizeFoodName(name)
			expect(normalizeFoodName(once)).toBe(once)
		}
	})

	it('fixes a look-alike word and a lone letter in one name', () => {
		const dirty = `${KURYACH + LAT_A} ${LAT_C} ${molokom}`
		expect(normalizeFoodName(dirty)).toBe(`${kuryacha} ${CYR_S} ${molokom}`)
	})

	it('really uses the Cyrillic code point for a lone letter', () => {
		const result = normalizeFoodName(`${kava} ${LAT_C} ${molokom}`)
		expect(result.codePointAt(kava.length + 1)).toBe(0x441)
	})
})
