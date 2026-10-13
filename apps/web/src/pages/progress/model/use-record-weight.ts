import { useNavigate } from 'react-router'

import { useStartMeasurementDraft } from '@/features/send-message'
import { ROUTES } from '@/shared/config'

/** «Записати вагу»: into the chat with «вага » waiting in the focused composer. */
export const useRecordWeight = (): (() => void) => {
	const navigate = useNavigate()
	const startWeightDraft = useStartMeasurementDraft('weight')

	return () => {
		startWeightDraft()
		void navigate(ROUTES.chat)
	}
}
