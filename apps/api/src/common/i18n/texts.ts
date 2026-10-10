import { Locale } from '../../generated/prisma/client'
import { type Texts, UK_TEXTS } from './uk'

// pl and en fall back to uk until those locales ship (CLAUDE.md §1)
const TEXTS_BY_LOCALE: Record<Locale, Texts> = {
	[Locale.uk]: UK_TEXTS,
	[Locale.pl]: UK_TEXTS,
	[Locale.en]: UK_TEXTS,
}

export const getTexts = (locale: Locale): Texts => TEXTS_BY_LOCALE[locale]

const PLACEHOLDER = /\{\{(\w+)\}\}/g

/** `{{name}}` → params.name; an unknown placeholder stays as it is, so a typo is visible. */
export const fillTemplate = (template: string, params: Record<string, string>): string =>
	template.replace(PLACEHOLDER, (placeholder: string, key: string) => params[key] ?? placeholder)
