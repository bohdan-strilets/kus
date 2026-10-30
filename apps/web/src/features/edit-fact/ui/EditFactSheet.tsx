import type { FactResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatFactSource } from '@/entities/fact'
import { BaseBottomSheet } from '@/shared/ui'

import { useFactActions } from '../model/use-fact-actions'
import { EditFactForm } from './EditFactForm'

interface EditFactSheetProps {
	/** The fact being edited; null — the sheet is closed. */
	fact: FactResponse | null
	onClose: () => void
}

/** mockups/memory-facts.html «Sheet факту»: «Факт» + «з чату, 12 жовтня», the sentence, save, delete. */
export const EditFactSheet = ({ fact, onClose }: EditFactSheetProps) => {
	const { t } = useTranslation()
	const actions = useFactActions({ onGone: onClose })
	// the sheet slides out with its content, so the last fact stays until it is gone
	const [shown, setShown] = useState<FactResponse | null>(fact)
	if (fact !== null && fact !== shown) setShown(fact)

	return (
		<BaseBottomSheet
			isOpen={fact !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
			title={t('editFact.title')}
			description={shown ? formatFactSource(shown, t) : undefined}
			initialFocus="first-field"
		>
			{shown && <EditFactForm key={shown.id} fact={shown} actions={actions} onDone={onClose} />}
		</BaseBottomSheet>
	)
}
