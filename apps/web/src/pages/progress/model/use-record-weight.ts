import { useNavigate } from 'react-router'

import { useStartWeightDraft } from '@/features/send-message'
import { ROUTES } from '@/shared/config'

/** «Записати вагу»: into the chat with «вага » waiting in the focused composer. */
export const useRecordWeight = (): (() => void) => {
	const navigate = useNavigate()
	const startWeightDraft = useStartWeightDraft()

	return () => {
		startWeightDraft()
		void navigate(ROUTES.chat)
	}
}
