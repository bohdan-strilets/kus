import type { FactProposal } from '@kus/shared'

export type FactProposalView = 'ask' | 'saved' | 'rejected'

const VIEW_BY_STATUS: Record<FactProposal['status'], FactProposalView> = {
	PROPOSED: 'ask',
	CONFIRMED: 'saved',
	REJECTED: 'rejected',
}

/**
 * What the plaque shows. A fact saved from an explicit «запам'ятай» arrives already CONFIRMED and
 * looks the same as after «Так»: the user sees what was stored and where to change it.
 */
export const getFactProposalView = (proposal: FactProposal): FactProposalView =>
	VIEW_BY_STATUS[proposal.status]
