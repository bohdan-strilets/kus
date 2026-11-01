import type { ChatMessage } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	type ProgramCardAction,
	type ProgramCardControls,
	ProgramDiffCard,
	ProgramProposalCard,
} from '@/entities/program'
import {
	getProgramActionError,
	useProgramProposalActions,
} from '@/features/accept-program-proposal'
import { useComposerDraftStore } from '@/features/send-message'
import { getApiError } from '@/shared/api'
import { useToast } from '@/shared/ui'

interface ProgramReplyCardProps {
	/** Kusik's message with `programCard`. */
	message: ChatMessage
	/** The card is the end of the training onboarding: its note counts the five answers. */
	isFromOnboarding: boolean
}

/** The program card of a reply, wired to «Прийняти» / «Перерахувати» and to the composer. */
export const ProgramReplyCard = ({ message, isFromOnboarding }: ProgramReplyCardProps) => {
	const { t } = useTranslation()
	const toast = useToast()
	const { accept, rebase } = useProgramProposalActions()
	const { programCard: card, programCardState: state } = message
	if (!card) return null

	const pendingAction: ProgramCardAction | null = accept.isPending
		? 'accept'
		: rebase.isPending
			? 'rebase'
			: null
	const handleError = (error: Error): void => {
		toast.show(getProgramActionError(getApiError(error), t))
	}
	const controls: ProgramCardControls = {
		status: state?.status ?? 'OPEN',
		versionCreatedAt: state?.versionCreatedAt ?? null,
		pendingAction,
		onAccept: () => {
			if (pendingAction === null) accept.mutate(message.id, { onError: handleError })
		},
		onRebase: () => {
			if (pendingAction === null) rebase.mutate(message.id, { onError: handleError })
		},
	}

	if (!card.changes.initial && card.baseVersionId !== null) {
		return <ProgramDiffCard card={card} controls={controls} />
	}
	return (
		<ProgramProposalCard
			card={card}
			controls={{
				...controls,
				onModify: () => {
					useComposerDraftStore.getState().requestFocus()
				},
			}}
			isFromOnboarding={isFromOnboarding}
		/>
	)
}
