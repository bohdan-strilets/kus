import { useTranslation } from 'react-i18next'

import { useComposerDraftStore } from './composer-draft-store'

export type MeasurementDraftKind = 'weight' | 'waist'

const DRAFT_KEYS = { weight: 'chat.weightDraft', waist: 'chat.waistDraft' } as const

/**
 * «Add a weight» / «Add a waist»: «вага » or «талія » waits in the composer so only the number is
 * left to type, and the field takes focus. A draft the user already has is kept as it is.
 */
export const useStartMeasurementDraft = (kind: MeasurementDraftKind): (() => void) => {
	const { t } = useTranslation()

	return () => {
		const { text, setText, requestFocus } = useComposerDraftStore.getState()
		if (text.trim() === '') setText(t(DRAFT_KEYS[kind]))
		requestFocus()
	}
}
