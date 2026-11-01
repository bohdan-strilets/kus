import {
	isValidOnboardingAnswer,
	TRAINING_ONBOARDING_MULTI_STEP,
	TRAINING_ONBOARDING_OPTIONS,
	type TrainingOnboardingQuestionStep,
} from '@kus/shared'

// The button labels of c6 §4 (uk.json `chat.trainingOnboarding.*`), so words typed instead of a tap
// count as the answer. pl / en labels join these lists when those locales ship.
const LABELS: Readonly<Record<TrainingOnboardingQuestionStep, Readonly<Record<string, string>>>> = {
	1: { GYM: 'Зал', HOME: 'Вдома', OUTDOOR: 'На вулиці', MIXED: 'По-різному' },
	2: {
		STRENGTH: 'Силові',
		CARDIO: 'Кардіо',
		STRENGTH_AND_CARDIO: 'Силові й кардіо',
		NOTHING_YET: 'Поки нічого',
	},
	3: { BEGINNER: 'Без досвіду', EXPERIENCED: 'Є досвід', CONFIDENT: 'Впевнено' },
	4: { '2': '2', '3': '3', '4': '4', '5+': '5+' },
	5: {
		FULL_GYM: 'Повний зал',
		DUMBBELLS: 'Гантелі',
		PULL_UP_BAR: 'Турнік',
		BANDS: 'Гумки',
		NONE: 'Нічого',
	},
}

const FINAL_PUNCTUATION = /[\s.,!?…;:]+$/u
const SPACES = /\s+/gu
/** «Гантелі, турнік», «гантелі і турнік», «гантелі та турнік». */
const LIST_SEPARATOR = /\s*,\s*|\s+(?:і|та)\s+/u
const PER_WEEK_NUMBER = /^(\d+)(\+?)$/u
const PER_WEEK_STEP: TrainingOnboardingQuestionStep = 4
const PER_WEEK_MIN = 2
const PER_WEEK_MAX = 5
const PER_WEEK_OPEN = '5+'

const normalize = (text: string): string =>
	text.trim().replace(FINAL_PUNCTUATION, '').replace(SPACES, ' ').toLocaleLowerCase('uk')

const matchLabel = (step: TrainingOnboardingQuestionStep, text: string): string | null => {
	const normalized = normalize(text)
	const found = Object.entries(LABELS[step]).find(([, label]) => normalize(label) === normalized)
	return found ? found[0] : null
}

/** «3» → '3'; «5», «5+» → '5+'; anything outside 2–5 is no answer. */
const matchPerWeek = (text: string): string | null => {
	const match = PER_WEEK_NUMBER.exec(normalize(text))
	if (!match) return null
	const count = Number(match[1])
	const isOpen = match[2] === '+'
	if (count === PER_WEEK_MAX) return PER_WEEK_OPEN
	if (isOpen || count < PER_WEEK_MIN || count > PER_WEEK_MAX) return null
	return String(count)
}

/** One label or a list of them; «Нічого» next to something is no answer. In the order of the buttons. */
const matchEquipment = (text: string): string[] | null => {
	const parts = normalize(text).split(LIST_SEPARATOR)
	const values = parts.map((part) => matchLabel(TRAINING_ONBOARDING_MULTI_STEP, part))
	if (values.some((value) => value === null)) return null
	const options = TRAINING_ONBOARDING_OPTIONS[TRAINING_ONBOARDING_MULTI_STEP]
	const unique = options.filter((option) => values.includes(option))
	return isValidOnboardingAnswer(TRAINING_ONBOARDING_MULTI_STEP, unique) ? unique : null
}

/**
 * The words of a message read as the answer to the open question: the values, or null when they
 * are something else (then the onboarding ends and the message goes to the model).
 */
export const matchOnboardingAnswer = (
	step: TrainingOnboardingQuestionStep,
	text: string,
): string[] | null => {
	if (step === TRAINING_ONBOARDING_MULTI_STEP) return matchEquipment(text)
	const value = step === PER_WEEK_STEP ? matchPerWeek(text) : matchLabel(step, text)
	return value === null ? null : [value]
}
