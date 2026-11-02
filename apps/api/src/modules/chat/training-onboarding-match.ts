import {
	isValidOnboardingAnswer,
	TRAINING_ONBOARDING_MULTI_STEP,
	TRAINING_ONBOARDING_OPTIONS,
	type TrainingOnboardingQuestionStep,
} from '@kus/shared'

const WORD_START = "(?<![\\p{L}'])"
const WORD_END = "(?![\\p{L}'])"

/** A keyword that starts at a word start and ends at a word end (or at the endings it lists). */
const keyword = (source: string): RegExp =>
	new RegExp(`${WORD_START}(?:${source})${WORD_END}`, 'gu')

const keywords = (...sources: string[]): RegExp[] => sources.map(keyword)

const GYM = 'зал(?:і|у|ом|а|и)?'

// Keywords of the options of c6 §4 (uk.json `chat.trainingOnboarding.*`), so words typed instead
// of a tap count as the answer. A false match records a wrong answer, a false null only ends the
// onboarding: when unsure, no match. pl / en keywords join these lists when those locales ship.
// Q4 (number a week) and the Q2 combo are handled in code.
const KEYWORDS: Readonly<
	Record<TrainingOnboardingQuestionStep, Readonly<Record<string, readonly RegExp[]>>>
> = {
	1: {
		GYM: keywords(GYM),
		HOME: keywords('вдома', 'дома'),
		OUTDOOR: keywords('вулиц\\p{L}*', 'надворі', 'на свіжому(?: повітрі)?'),
		MIXED: keywords('по-?\\s?різному', 'різн(?:о|е)'),
	},
	2: {
		STRENGTH: keywords('силов\\p{L}*'),
		CARDIO: keywords('кардіо'),
		NOTHING_YET: keywords('поки нічого', 'нічого'),
	},
	3: {
		BEGINNER: keywords(
			'без досвіду',
			'немає досвіду',
			'нема досвіду',
			'новач\\p{L}*',
			'почина\\p{L}*',
			'початків\\p{L}*',
		),
		EXPERIENCED: keywords('є досвід\\p{L}*'),
		CONFIDENT: keywords('впевнен\\p{L}*', 'кілька років'),
	},
	4: {},
	5: {
		FULL_GYM: keywords('повний зал', GYM),
		DUMBBELLS: keywords('гантел\\p{L}*'),
		PULL_UP_BAR: keywords('турнік\\p{L}*'),
		BANDS: keywords('гумк\\p{L}*', 'резинк\\p{L}*'),
		NONE: keywords('нічого', 'немає'),
	},
}

// «різниця» is a question («а яка різниця?»), not the «По-різному» option that «різн» stands for
const NOT_KEYWORD_WORDS = /різниц\p{L}*/gu
const QUESTION_MARK = '?'
const APOSTROPHES = /[’ʼ`]/gu
const SPACES = /\s+/gu
const TOKEN_SEPARATOR = /[^\p{L}\p{N}'+]+/u
const NUMBER_TOKEN = /^(\d+)(\+?)$/u
const PER_MONTH = /раз\p{L}*\s+на\s+місяць/u
const PER_WEEK_UNIT = /^(?:хв\p{L}*|год\p{L}*|кг|км|м)$/u
const NEGATION_WINDOW = 2
const NEGATIONS: ReadonlySet<string> = new Set(['не', 'ні', 'без', 'немає', 'нема', 'ніяк'])
// answers that are negative themselves: «нічого не робив» is an answer, not a denied one
const NEGATIVE_ANSWERS: ReadonlySet<string> = new Set(['поки нічого', 'нічого', 'немає', 'нема'])
const COMBO_STEP: TrainingOnboardingQuestionStep = 2
const PER_WEEK_STEP: TrainingOnboardingQuestionStep = 4
const PER_WEEK_MIN = 2
const PER_WEEK_OPEN_FROM = 5
const PER_WEEK_MAX = 7
const PER_WEEK_OPEN = '5+'
const STRENGTH = 'STRENGTH'
const CARDIO = 'CARDIO'
const STRENGTH_AND_CARDIO = 'STRENGTH_AND_CARDIO'

const NUMBER_WORDS: Readonly<Record<string, number>> = {
	один: 1,
	одне: 1,
	два: 2,
	дві: 2,
	двічі: 2,
	три: 3,
	тричі: 3,
	чотири: 4,
	"п'ять": 5,
	шість: 6,
	сім: 7,
	вісім: 8,
	"дев'ять": 9,
	десять: 10,
}

// Only case, apostrophes and spaces are unified (not ё/е and the like).
const normalize = (text: string): string =>
	text.toLocaleLowerCase('uk').replace(APOSTROPHES, "'").trim().replace(SPACES, ' ')

const toWords = (text: string): string[] => text.split(TOKEN_SEPARATOR).filter(Boolean)

/** A negation within two words around the keyword turns the message into no answer. */
const isNegated = (text: string, index: number, matched: string): boolean => {
	const before = toWords(text.slice(0, index)).slice(-NEGATION_WINDOW)
	const after = NEGATIVE_ANSWERS.has(matched)
		? []
		: toWords(text.slice(index + matched.length)).slice(0, NEGATION_WINDOW)
	return [...before, ...after].some((word) => NEGATIONS.has(word))
}

/** The options whose keyword is present, or null when any of them is negated. */
const matchKeywords = (step: TrainingOnboardingQuestionStep, text: string): string[] | null => {
	const cleaned = text.replace(NOT_KEYWORD_WORDS, ' ')
	const found: string[] = []
	for (const [value, patterns] of Object.entries(KEYWORDS[step])) {
		let isFound = false
		for (const pattern of patterns) {
			for (const match of cleaned.matchAll(pattern)) {
				if (isNegated(cleaned, match.index, match[0])) return null
				isFound = true
			}
		}
		if (isFound) found.push(value)
	}
	return found
}

/** Exactly one option for the keywords; «силові» together with «кардіо» is the combo option. */
const matchSingle = (step: TrainingOnboardingQuestionStep, text: string): string | null => {
	const found = matchKeywords(step, text)
	if (found === null) return null
	const isCombo = step === COMBO_STEP && found.includes(STRENGTH) && found.includes(CARDIO)
	if (isCombo) return found.length === 2 ? STRENGTH_AND_CARDIO : null
	return found.length === 1 ? (found[0] ?? null) : null
}

/** A count of 2–7 → '2'–'4' or '5+'; anything else (1, 8+, «3+») is no answer. */
const toPerWeek = (count: number, isOpen: boolean): string | null => {
	if (count < PER_WEEK_MIN || count > PER_WEEK_MAX) return null
	if (count >= PER_WEEK_OPEN_FROM) return PER_WEEK_OPEN
	return isOpen ? null : String(count)
}

/** The count a token stands for, or null when it is not a number at all. */
const readCount = (token: string): { count: number; isOpen: boolean } | null => {
	const numeric = NUMBER_TOKEN.exec(token)
	if (numeric) return { count: Number(numeric[1]), isOpen: numeric[2] === '+' }
	const word = NUMBER_WORDS[token]
	return word === undefined ? null : { count: word, isOpen: false }
}

/**
 * «3 рази» → '3'; «5», «5+», «шість» → '5+'; several different numbers, a number out of 2–7 or
 * with a unit («30 хвилин», «10 хв») are no answer.
 */
const matchPerWeek = (text: string): string | null => {
	if (PER_MONTH.test(text)) return null
	const tokens = toWords(text)
	const values = new Set<string>()
	for (const [index, token] of tokens.entries()) {
		const read = readCount(token)
		if (read === null) continue
		const next = tokens[index + 1]
		if (next !== undefined && PER_WEEK_UNIT.test(next)) return null
		const value = toPerWeek(read.count, read.isOpen)
		if (value === null) return null
		values.add(value)
	}
	if (values.size !== 1) return null
	return [...values][0] ?? null
}

/** Every option whose keyword is present, in the order of the buttons; «Нічого» next to others is no answer. */
const matchEquipment = (text: string): string[] | null => {
	const found = matchKeywords(TRAINING_ONBOARDING_MULTI_STEP, text)
	if (found === null) return null
	const options = TRAINING_ONBOARDING_OPTIONS[TRAINING_ONBOARDING_MULTI_STEP]
	const ordered = options.filter((option) => found.includes(option))
	return isValidOnboardingAnswer(TRAINING_ONBOARDING_MULTI_STEP, ordered) ? ordered : null
}

/**
 * The words of a message read as the answer to the open question: the values, or null when they
 * are something else (then the onboarding ends and the message goes to the model).
 */
export const matchOnboardingAnswer = (
	step: TrainingOnboardingQuestionStep,
	text: string,
): string[] | null => {
	const normalized = normalize(text)
	// a question («а в чому різниця між залом і домом?») is never an answer, even with a keyword
	if (normalized.includes(QUESTION_MARK)) return null
	if (step === TRAINING_ONBOARDING_MULTI_STEP) return matchEquipment(normalized)
	const value = step === PER_WEEK_STEP ? matchPerWeek(normalized) : matchSingle(step, normalized)
	return value === null ? null : [value]
}
