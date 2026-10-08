import type { ClarificationResponse } from '@kus/shared'

import { INTL_LOCALE } from '@/shared/lib'

/**
 * «суха?» under «Гречка варена · 100 г» (mockups/chat.html): with two answers, the one farther
 * from what was logged is the doubt. More answers have no single doubt — null, the card opens.
 */
export const getClarifyHint = (
	{ options }: Pick<ClarificationResponse, 'options'>,
	loggedKcal: number,
): string | null => {
	if (options.length !== 2) return null
	const [doubt] = options.toSorted(
		(a, b) => Math.abs(b.kcal - loggedKcal) - Math.abs(a.kcal - loggedKcal),
	)
	return doubt ? `${doubt.label.toLocaleLowerCase(INTL_LOCALE)}?` : null
}
