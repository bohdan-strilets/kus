import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { TRAINING_PROGRAM_ROUTE } from '@/shared/config'
import { cn, formatShortDate } from '@/shared/lib'
import { Button, Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

import type { ProgramCardControls } from './program-card.types'

interface ProgramCardFrameProps {
	controls: ProgramCardControls
	/** The line above the buttons while the card is open. */
	note: string
	children: ReactNode
}

const isDimmed = (status: ProgramCardControls['status']): boolean =>
	status === 'ACCEPTED' || status === 'REPLACED'

/**
 * The card of a program proposal or its changes (mockups/chat-program.html): the body, the note
 * and the buttons while the card is open. Accepted and replaced cards dim to 55 %; an accepted
 * one gets the plaque under it with the link to the program; an outdated one offers «Перерахувати».
 */
export const ProgramCardFrame = ({ controls, note, children }: ProgramCardFrameProps) => {
	const { t } = useTranslation()
	const { status, versionCreatedAt, pendingAction, onAccept, onRebase, onModify } = controls
	const isPending = pendingAction !== null

	return (
		<div className="flex flex-col gap-1.5">
			<Surface className={cn('flex flex-col gap-2.5 p-3.5', isDimmed(status) && 'opacity-55')}>
				{children}
				{status === 'OPEN' && (
					<>
						<Text variant="small" tone="muted" weight="regular">
							{note}
						</Text>
						<div className={cn('grid gap-2', onModify && 'grid-cols-2')}>
							<Button
								size="md"
								className="min-h-tap"
								isLoading={pendingAction === 'accept'}
								disabled={isPending}
								onClick={onAccept}
							>
								{t('program.card.accept')}
							</Button>
							{onModify && (
								<Button
									size="md"
									variant="secondary"
									className="min-h-tap"
									disabled={isPending}
									onClick={onModify}
								>
									{t('program.card.modify')}
								</Button>
							)}
						</div>
					</>
				)}
				{status === 'OUTDATED' && (
					<>
						<Text variant="caption" tone="muted" role="status">
							{t('program.card.outdated')}
						</Text>
						<Button
							size="md"
							className="min-h-tap"
							isLoading={pendingAction === 'rebase'}
							disabled={isPending}
							onClick={onRebase}
						>
							{t('program.card.rebase')}
						</Button>
					</>
				)}
			</Surface>
			{status === 'ACCEPTED' && (
				<div className="flex flex-col gap-0.5 rounded-tile bg-success-soft px-3 py-2" role="status">
					<Text
						as="span"
						variant="cardTitle"
						tone="successInk"
						weight="bold"
						className="flex items-center gap-1.5"
					>
						<Icon name="check" size={ICON_SIZE.small} />
						{versionCreatedAt === null
							? t('program.card.accepted')
							: t('program.card.acceptedVersion', {
									date: formatShortDate(new Date(versionCreatedAt)),
								})}
					</Text>
					<Link
						to={TRAINING_PROGRAM_ROUTE}
						className="inline-flex min-h-tap items-center gap-1 text-card-title font-bold text-primary-deep underline underline-offset-2"
					>
						{t('program.card.open')}
						<Icon name="chevron-right" size={ICON_SIZE.small} />
					</Link>
				</div>
			)}
		</div>
	)
}
