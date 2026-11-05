/**
 * Checks that run on every reply of a run, not only where a case expects something:
 * gendered forms about the user, item names the user never wrote, the reply language, templates.
 * Heuristics on purpose — they flag for a human look, the copy rules live in the prompt.
 */

import { type AddressForm, parseRichText } from '@kus/shared'

import type { ReplyLanguage } from './cases/case.types.js'

const WORD_PATTERN = /[\p{L}'’ʼ]+/gu
const CLAUSE_SPLIT_PATTERN = /[.,!?;:…—–()\n]+/u
const APOSTROPHES_PATTERN = /['’ʼ]/gu

const YOU_WORDS = new Set(['ти', 'ты'])
/** Past tense and short adjectives after "ти": they name the user's gender. */
const AFTER_YOU_SCAN = 3
const PAST_MASCULINE_PATTERN = /[аеиіїуяюо]в(ся)?$|л(ся)?$/u
const PAST_FEMININE_PATTERN = /ла(ся|сь)?$/u
const ADJECTIVE_MASCULINE_PATTERN = /(ий|ый)$/u
const ADJECTIVE_FEMININE_PATTERN = /(на|та|ова)$/u
const MIN_ADJECTIVE_LENGTH = 4
/** Polish 2nd person past is always gendered: zjadłeś / zjadłaś. */
const POLISH_MASCULINE_PATTERN = /\p{L}+(łeś|łbyś)(?!\p{L})/giu
const POLISH_FEMININE_PATTERN = /\p{L}+(łaś|łabyś)(?!\p{L})/giu
/** "записав(-ла)", "готовий/а" — a double form still names a gender. */
const DOUBLE_FORM_PATTERN = /\p{L}+\s?[(/]\s?-?(ла|а|ая|ий)\)?(?!\p{L})/giu

/** both — a double form ("записав(-ла)"): wrong whatever the user chose. */
type FormGender = 'masculine' | 'feminine' | 'both'

interface GenderedForm {
	form: string
	gender: FormGender
}

const toWords = (text: string): string[] =>
	(text.toLowerCase().match(WORD_PATTERN) ?? []).map((word) =>
		word.replace(APOSTROPHES_PATTERN, ''),
	)

const getWordGender = (word: string): FormGender | null => {
	if (PAST_FEMININE_PATTERN.test(word)) return 'feminine'
	if (PAST_MASCULINE_PATTERN.test(word)) return 'masculine'
	if (word.length < MIN_ADJECTIVE_LENGTH) return null
	if (ADJECTIVE_MASCULINE_PATTERN.test(word)) return 'masculine'
	return ADJECTIVE_FEMININE_PATTERN.test(word) ? 'feminine' : null
}

const findAfterYou = (clause: string): GenderedForm[] => {
	const words = toWords(clause)
	return words.flatMap((word, index) => {
		if (!YOU_WORDS.has(word)) return []
		return words.slice(index + 1, index + 1 + AFTER_YOU_SCAN).flatMap((next) => {
			const gender = getWordGender(next)
			return gender === null ? [] : [{ form: `${word} … ${next}`, gender }]
		})
	})
}

const toForms = (matches: RegExpMatchArray | null, gender: FormGender): GenderedForm[] =>
	(matches ?? []).map((form) => ({ form, gender }))

/** Forms that name the user's gender; Kusik about himself ("я записав") is fine and not flagged. */
export const classifyGenderedForms = (reply: string): GenderedForm[] => [
	...reply.split(CLAUSE_SPLIT_PATTERN).flatMap(findAfterYou),
	...toForms(reply.match(POLISH_MASCULINE_PATTERN), 'masculine'),
	...toForms(reply.match(POLISH_FEMININE_PATTERN), 'feminine'),
	...toForms(reply.match(DOUBLE_FORM_PATTERN), 'both'),
]

const FORM_GENDER: Record<Exclude<AddressForm, 'NEUTRAL'>, FormGender> = {
	MASCULINE: 'masculine',
	FEMININE: 'feminine',
}

/**
 * The forms that are a mistake for this user: with neutral any gendered form is; with masculine or
 * feminine only the opposite one (and a double form) is.
 */
export const findGenderedForms = (
	reply: string,
	addressForm: AddressForm = 'NEUTRAL',
): string[] => {
	const wrong = classifyGenderedForms(reply).filter(
		({ gender }) =>
			addressForm === 'NEUTRAL' || gender === 'both' || gender !== FORM_GENDER[addressForm],
	)
	return [...new Set(wrong.map(({ form }) => form.toLowerCase()))]
}

const LANGUAGE_MARKERS: Record<ReplyLanguage, RegExp> = {
	uk: /[іїєґ]/iu,
	ru: /[ыэъё]/iu,
	pl: /[ąęłśżźćńó]/iu,
}

/** Russian words with no Ukrainian twin: Russian without ы/э/ъ/ё still shows itself ("Вот сводка за 10 дней"). */
const RUSSIAN_WORDS = new Set([
	'и',
	'вот',
	'что',
	'это',
	'как',
	'нет',
	'если',
	'сегодня',
	'дней',
	'можно',
	'нужно',
	'очень',
	'тоже',
	'еще',
	'ещё',
])
const CYRILLIC_PATTERN = /\p{Script=Cyrillic}/u
const LATIN_PATTERN = /\p{Script=Latin}/u

/**
 * Polish words that need no diacritics: a model may skip them ("Zapisane: owsianka na mleku").
 * None of them is English, so a plain "kebab 400 g" stays unknown.
 */
const POLISH_WORDS = new Set([
	'nie',
	'jest',
	'sie',
	'czy',
	'oraz',
	'dla',
	'juz',
	'jeszcze',
	'tylko',
	'bardzo',
	'dzisiaj',
	'zapisane',
	'zapisalem',
	'zapisalam',
	'dodalem',
	'smacznego',
	'kalorii',
	'mleku',
	'jajka',
])

const hasRussianWord = (text: string): boolean =>
	toWords(text).some((word) => RUSSIAN_WORDS.has(word))

const hasPolishWord = (text: string): boolean =>
	LATIN_PATTERN.test(text) && toWords(text).some((word) => POLISH_WORDS.has(word))

/**
 * Only when the letters leave no doubt; plain Cyrillic or plain Latin → null. A message mixing
 * Cyrillic and Latin words ("чи можна jeść jajka") has no single language → null.
 */
export const detectLanguage = (text: string): ReplyLanguage | null => {
	if (CYRILLIC_PATTERN.test(text) && LATIN_PATTERN.test(text)) return null
	const found = (Object.keys(LANGUAGE_MARKERS) as ReplyLanguage[]).filter((language) =>
		LANGUAGE_MARKERS[language].test(text),
	)
	if (found.length === 0 && hasRussianWord(text)) return 'ru'
	if (found.length === 0 && hasPolishWord(text)) return 'pl'
	return found.length === 1 ? (found[0] ?? null) : null
}

const MIN_NAME_WORD_LENGTH = 3
const SHORT_WORD_LENGTH = 4
const MIN_LONG_STEM = 4
/** Endings change in Ukrainian (гречка → гречку, крильця → крилець); the stem may not (сливи ≠ слизу). */
const ENDING_SLACK = 3

const getCommonPrefixLength = (a: string, b: string): number => {
	let length = 0
	while (length < a.length && length < b.length && a[length] === b[length]) length += 1
	return length
}

const isSameStem = (a: string, b: string): boolean => {
	const minLength = Math.min(a.length, b.length)
	const needed =
		minLength <= SHORT_WORD_LENGTH
			? Math.max(2, minLength - 1)
			: Math.max(MIN_LONG_STEM, minLength - ENDING_SLACK)
	return getCommonPrefixLength(a, b) >= needed
}

/** Some word of the item name shares a stem with a word the user wrote. */
export const isNameFromText = (name: string, text: string): boolean => {
	const textWords = toWords(text)
	const nameWords = toWords(name).filter((word) => word.length >= MIN_NAME_WORD_LENGTH)
	if (nameWords.length === 0) return true
	return nameWords.some((nameWord) => textWords.some((textWord) => isSameStem(nameWord, textWord)))
}

const OPENING_WORDS = 3

/** The first words of a reply, to spot a phrase the model repeats from case to case. */
export const getReplyOpening = (reply: string): string =>
	toWords(reply).slice(0, OPENING_WORDS).join(' ')

/**
 * Words that judge food, a meal or a day (the prompt forbids them even when the user says them).
 * Stems match by the beginning of a word; "погано" only as a whole word, so "непогано" is fine.
 * `\b` does not work with Cyrillic, hence the letter look-arounds.
 */
const JUDGING_STEMS = [
	'зрив',
	'зірв',
	'шкідлив',
	'чіт-міл',
	'читмил',
	'гріх',
	'грішн',
	'провал',
	'заборонен',
	'винн',
	'відпрацю',
	'компенсу',
] as const
const JUDGING_WHOLE_WORDS = ['погано'] as const
const JUDGING_PATTERN = new RegExp(
	String.raw`(?<!\p{L})(?:(?:${JUDGING_STEMS.join('|')})\p{L}*|(?:${JUDGING_WHOLE_WORDS.join('|')})(?!\p{L}))`,
	'giu',
)

/** The judging words of a reply, lower-case and without repeats; empty = none. */
export const findJudgingWords = (reply: string): string[] => [
	...new Set((reply.match(JUDGING_PATTERN) ?? []).map((word) => word.toLowerCase())),
]

const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/mu
const LINK_PATTERN = /\[[^\]\n]*\]\([^)\n]*\)/u
const NESTED_LIST_PATTERN = /^[ \t]+(?:[-*•]|\d+[.)])[ \t]+\S/mu
const HEADING_LINE_PATTERN = /^\s*#{1,6}[ \t]+(.+)$/gmu
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu
const MAX_HEADING_WORDS = 4
const SHORT_REPLY_LINES = 2
const MAX_EMOJI = 2

const countWords = (text: string): number => text.trim().split(/\s+/u).length

const countLines = (reply: string): number =>
	reply.split(/\r?\n/u).filter((line) => line.trim().length > 0).length

/**
 * Format the prompt forbids or reserves for longer replies: tables, links, code, a nested list, a
 * heading over 4 words, headings or lists in a 1–2 line reply, too many emoji (or any in a short reply).
 * Codes, not texts, so a report can group them; empty = clean.
 */
export const findMarkupViolations = (reply: string): string[] => {
	const violations: string[] = []
	const blocks = parseRichText(reply)
	const isShort = countLines(reply) <= SHORT_REPLY_LINES
	if (TABLE_ROW_PATTERN.test(reply)) violations.push('table')
	if (LINK_PATTERN.test(reply)) violations.push('link')
	if (reply.includes('`')) violations.push('code')
	if (NESTED_LIST_PATTERN.test(reply)) violations.push('nested-list')
	const headings = [...reply.matchAll(HEADING_LINE_PATTERN)]
	if (headings.some((match) => countWords(match[1] ?? '') > MAX_HEADING_WORDS)) {
		violations.push('long-heading')
	}
	if (isShort && blocks.some((block) => block.type !== 'paragraph'))
		violations.push('block-in-short')
	const emojiCount = (reply.match(EMOJI_PATTERN) ?? []).length
	if (emojiCount > MAX_EMOJI) violations.push('many-emoji')
	else if (emojiCount > 0 && isShort) violations.push('emoji-in-short')
	return violations
}
