// What a saved fact must never be (CLAUDE.md §10, RODO): a diagnosis or a health state, body numbers,
// or an instruction for the model. One check for the model's save_fact and for the «Пам'ять» edit sheet.

import { normalizeName } from './memory-match.js'

export const FACT_TEXT_ISSUES = ['HEALTH_DATA', 'BODY_DATA', 'INSTRUCTION'] as const

export type FactTextIssue = (typeof FACT_TEXT_ISSUES)[number]

// a stem starts a word: no letter right before it (\b doesn't see Cyrillic)
const startsWord = (stems: string[]): RegExp => new RegExp(`(?<!\\p{L})(${stems.join('|')})`, 'iu')

/**
 * Diagnoses, conditions and medicines (uk, ru, pl, en stems). «Не їсть X» stays allowed: «без
 * лактози» is a habit, «непереносимість лактози» is a diagnosis.
 */
const HEALTH_PATTERN = startsWord([
	'діабет',
	'диабет',
	'cukrzyc',
	'diabet',
	'алергі',
	'аллерги',
	'alergi',
	'allerg',
	'непереносим',
	'nietoleranc',
	'intoleran',
	'целіак',
	'целиак',
	'celiak',
	'coeliac',
	'celiac',
	'хвороб',
	'болезн',
	'захворюв',
	'chorob',
	'disease',
	'діагноз',
	'диагноз',
	'diagnoz',
	'diagnos',
	'лік(и|ів|ами)(?!\\p{L})',
	'лекарств',
	'таблетк',
	'tablet',
	'medicat',
	'вагітн',
	'беремен',
	'ciąż',
	'pregnan',
	'гастрит',
	'виразк',
	'панкреатит',
	'подагр',
	'холестерин',
	'анемі',
	'щитовид',
	'гіпотиреоз',
	'інсулін',
	'инсулин',
	'insulin',
	'депресі',
	'булімі',
	'анорексі',
	'компульсивн',
	'розлад',
	'расстройств',
])

/**
 * Weight, height and sizes belong to log_measurement and the profile, never to a fact. Only a body
 * word next to a number counts: «жим 80 кг» is a training fact, not the body.
 */
const BODY_WORD_PATTERN = startsWord([
	'важу',
	'вага',
	'ваги',
	'вешу',
	'вес(?!\\p{L})',
	'waga',
	'ważę',
	'weigh',
	'талі',
	'талия',
	'waist',
	'зріст',
	'рост(?!\\p{L})',
	'wzrost',
	'height',
	'імт',
	'bmi',
])
const NUMBER_PATTERN = /\d/

/** Text that talks to the model instead of describing the user. */
const INSTRUCTION_PATTERN = startsWord([
	'ігнору',
	'игнориру',
	'ignore',
	'zignoruj',
	'інструкці',
	'инструкци',
	'instruction',
	'system prompt',
	'промпт',
	'prompt',
	'завжди відповідай',
	'always answer',
	'always reply',
])

/** The first rule the text breaks, or null when it may be saved. */
export const getFactTextIssue = (text: string): FactTextIssue | null => {
	const normalized = normalizeName(text)
	if (INSTRUCTION_PATTERN.test(normalized)) return 'INSTRUCTION'
	if (HEALTH_PATTERN.test(normalized)) return 'HEALTH_DATA'
	if (NUMBER_PATTERN.test(normalized) && BODY_WORD_PATTERN.test(normalized)) return 'BODY_DATA'
	return null
}

/** Same as MyFood.nameNormalized and UserFact.textNormalized: lowercase, trimmed, single spaces. */
export const normalizeFactText = normalizeName
