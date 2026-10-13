import { useTranslation } from 'react-i18next'

import { useComposerDraftStore } from './composer-draft-store'

/**
 * «Add a weight»: «вага » waits in the composer so only the number is left to type, and the field
 * takes focus. A draft the user already has is kept as it is.
 */
export const useStartWeightDraft = (): (() => void) => {
	const { t } = useTranslation()

	return () => {
		const { text, setText, requestFocus } = useComposerDraftStore.getState()
		if (text.trim() === '') setText(t('chat.weightDraft'))
		requestFocus()
	}
}
