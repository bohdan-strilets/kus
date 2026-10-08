import { INTL_LOCALE } from '../format'

/**
 * Ukrainian vocative of a first name for «Добрий вечір, Богдане». Only endings with one safe rule;
 * anything else (Latin script, two words, «Таня» vs «Наталя», «Ігор» vs «Віктор») gives null and
 * the greeting goes without a name — a wrong case is worse than none. A «how should I call you»
 * field from the profile will take priority over these rules.
 */

const CYRILLIC_NAME = /^[А-ЩЬЮЯҐЄІЇа-щьюяґєії'’-]{2,}$/u

/** Common names the endings below would get wrong. */
const EXCEPTIONS: Record<string, string> = {
	ігор: 'Ігорю',
	лев: 'Льве',
	олег: 'Олеже',
}

interface EndingRule {
	ending: RegExp
	replace: (stem: string) => string
}

const RULES: EndingRule[] = [
	// Олена → Олено, Микола → Миколо, Ольга → Ольго
	{ ending: /а$/u, replace: (name) => `${name.slice(0, -1)}о` },
	// Марія → Маріє, Юлія → Юліє; other -я names split (Таню / Натале), so they get no rule
	{ ending: /ія$/u, replace: (name) => `${name.slice(0, -1)}є` },
	// Андрій → Андрію, Олексій → Олексію
	{ ending: /й$/u, replace: (name) => `${name.slice(0, -1)}ю` },
	// Василь → Василю
	{ ending: /ь$/u, replace: (name) => `${name.slice(0, -1)}ю` },
	// Дмитро → Дмитре, Павло → Павле
	{ ending: /о$/u, replace: (name) => `${name.slice(0, -1)}е` },
	// Марк → Марку
	{ ending: /[кгх]$/u, replace: (name) => `${name}у` },
	// Богдан → Богдане, Тарас → Тарасе, Олександр → Олександре
	{ ending: /[бвдзлмнпрстфц]$/u, replace: (name) => `${name}е` },
]

const capitalize = (text: string): string =>
	text.charAt(0).toLocaleUpperCase(INTL_LOCALE) + text.slice(1)

export const getVocative = (name: string): string | null => {
	const trimmed = name.trim()
	if (!CYRILLIC_NAME.test(trimmed)) return null
	const lower = trimmed.toLocaleLowerCase(INTL_LOCALE)
	const exception = EXCEPTIONS[lower]
	if (exception) return exception
	const rule = RULES.find(({ ending }) => ending.test(lower))
	return rule ? capitalize(rule.replace(lower)) : null
}
