import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useComposerDraftStore } from '@/features/send-message'
import { ROUTES } from '@/shared/config'

/**
 * «Записати вагу»: into the chat with «вага » waiting in the composer, so only the number is left
 * to type. A draft the user already has is not overwritten.
 */
export const useRecordWeight = (): (() => void) => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return () => {
		const { text, setText } = useComposerDraftStore.getState()
		if (text.trim() === '') setText(t('progress.recordWeightDraft'))
		void navigate(ROUTES.chat)
	}
}
