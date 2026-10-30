import type { FactProposal } from '@kus/shared'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { MEMORY_FACTS_HREF } from '@/shared/config'
import { TRANSITION } from '@/shared/lib'
import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

import { getFactProposalView } from '../lib/get-fact-proposal-view'
import { useAnswerFactProposal } from '../model/use-answer-fact-proposal'

interface FactProposalPlaqueProps {
	proposal: FactProposal
}

const APPEAR = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: TRANSITION.base }

/**
 * A fact Kusik wants to remember, inside his bubble (mockups/memory-facts.html): the question with
 * «Так» / «Ні», then «Запам'ятав» with a link to «Пам'ять», or the muted «Не запам'ятовую.».
 * Nothing is stored until «Так».
 */
export const FactProposalPlaque = ({ proposal }: FactProposalPlaqueProps) => {
	const { t } = useTranslation()
	const { answer, isPending, pendingAccept, notice } = useAnswerFactProposal(proposal.id)
	const view = getFactProposalView(proposal)

	if (view === 'rejected') {
		return (
			<motion.div {...APPEAR}>
				<Text variant="cardTitle" tone="muted">
					{t('factProposal.rejected')}
				</Text>
			</motion.div>
		)
	}

	if (view === 'saved') {
		return (
			<motion.div {...APPEAR} className="flex flex-col gap-1 rounded-tile bg-field px-3 py-2.5">
				<Text variant="cardTitle" tone="mutedStrong">
					{t('factProposal.quote', { text: proposal.text })}
				</Text>
				<Text
					as="span"
					variant="caption"
					tone="successInk"
					weight="bold"
					role="status"
					className="flex items-center gap-1.5"
				>
					<Icon name="check" size={ICON_SIZE.small} />
					{t('factProposal.saved')}
				</Text>
				<Link
					to={MEMORY_FACTS_HREF}
					className="inline-flex min-h-tap items-center text-card-title font-bold text-primary"
				>
					{t('factProposal.change')}
				</Link>
			</motion.div>
		)
	}

	return (
		<div className="flex flex-col gap-2.5 rounded-tile bg-primary-selected p-3">
			<Text weight="semibold">{t('factProposal.question', { text: proposal.text })}</Text>
			<div className="flex gap-2">
				<Button
					size="md"
					className="min-h-tap"
					disabled={isPending}
					isLoading={pendingAccept === true}
					onClick={() => {
						answer(true)
					}}
				>
					{t('factProposal.yes')}
				</Button>
				<Button
					size="md"
					variant="secondary"
					className="min-h-tap bg-surface"
					disabled={isPending}
					isLoading={pendingAccept === false}
					onClick={() => {
						answer(false)
					}}
				>
					{t('factProposal.no')}
				</Button>
			</div>
			{notice && (
				<Text variant="caption" tone="muted" role="status">
					{notice}
				</Text>
			)}
		</div>
	)
}
