import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import type { MacroHint } from '../lib/get-macro-hint'

interface MacroKcalHintProps {
	hint: MacroHint | null
	/** A mismatch the server reported, shown while there is no live hint. */
	errorMessage?: string
}

const getHintText = (hint: MacroHint, t: ReturnType<typeof useTranslation>['t']): string => {
	if (hint.isConsistent) return t('editGoals.hintOk', { macroKcal: formatInteger(hint.macroKcal) })
	return t(hint.deltaPct > 0 ? 'editGoals.hintMore' : 'editGoals.hintLess', {
		macroKcal: formatInteger(hint.macroKcal),
		delta: Math.abs(hint.deltaPct),
	})
}

/** «З Б/В/Ж виходить ≈ N ккал — близько до цілі» — danger when the API would refuse the split. */
export const MacroKcalHint = ({ hint, errorMessage }: MacroKcalHintProps) => {
	const { t } = useTranslation()
	if (hint === null && !errorMessage) return null

	const isDanger = hint === null || !hint.isConsistent
	const text = hint === null ? errorMessage : getHintText(hint, t)

	return (
		<div role="status" className="flex items-center gap-2">
			<Icon
				name="info"
				size={ICON_SIZE.control}
				className={isDanger ? 'shrink-0 text-danger' : 'shrink-0 text-muted'}
			/>
			<Text as="span" variant="caption" weight="regular" tone={isDanger ? 'danger' : 'mutedStrong'}>
				{text}
			</Text>
		</div>
	)
}
