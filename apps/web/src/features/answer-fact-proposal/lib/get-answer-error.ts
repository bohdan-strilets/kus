import { FACTS_MAX } from '@kus/shared'
import type { TFunction } from 'i18next'

import type { ApiError } from '@/shared/api'

export interface AnswerErrorOutcome {
	/** Under the buttons in the plaque: the proposal stays open, the user can still say «Ні». */
	notice: string | null
	/** For a failure of the action itself. */
	toast: string | null
	/** The server knows better (answered elsewhere, gone): reload the feed and the facts. */
	shouldRefresh: boolean
}

/** What to do with a failed answer: the limit is the plaque's line, the rest is a toast or a quiet reload. */
export const getAnswerErrorOutcome = (error: ApiError, t: TFunction): AnswerErrorOutcome => {
	if (error.kind === 'network') {
		return { notice: null, toast: t('errors.api.NETWORK'), shouldRefresh: false }
	}
	if (error.kind === 'http') {
		if (error.errorCode === 'FACTS_LIMIT_REACHED') {
			return {
				notice: t('errors.api.FACTS_LIMIT_REACHED', { count: FACTS_MAX }),
				toast: null,
				shouldRefresh: false,
			}
		}
		// answered in another tab: the refreshed message shows the current status
		if (error.errorCode === 'FACT_NOT_PROPOSED') {
			return { notice: null, toast: null, shouldRefresh: true }
		}
		if (error.errorCode === 'FACT_NOT_FOUND') {
			return { notice: null, toast: t('errors.api.FACT_NOT_FOUND'), shouldRefresh: true }
		}
	}
	return { notice: null, toast: t('factProposal.answerError'), shouldRefresh: false }
}
