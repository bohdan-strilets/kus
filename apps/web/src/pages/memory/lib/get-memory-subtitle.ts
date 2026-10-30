import type { TFunction } from 'i18next'

interface MemoryCounts {
	/** null — not loaded (yet); the part is left out. */
	productsCount: number | null
	factsCount: number | null
}

const SEPARATOR = ' · '

/** «5 фактів · 8 продуктів» as in mockups/memory-facts.html; a part with nothing (or not loaded) is left out. */
export const getMemorySubtitle = (
	{ productsCount, factsCount }: MemoryCounts,
	t: TFunction,
): string | undefined => {
	const parts: string[] = []
	if (factsCount) parts.push(t('memory.subtitle.facts', { count: factsCount }))
	if (productsCount) parts.push(t('memory.subtitle.products', { count: productsCount }))
	return parts.length > 0 ? parts.join(SEPARATOR) : undefined
}
