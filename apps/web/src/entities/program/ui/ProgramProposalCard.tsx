import type { ProgramCard } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { DETAIL_SEPARATOR } from '@/entities/workout'
import { Icon, Text } from '@/shared/ui'

import type { ProgramCardControls } from './program-card.types'
import { ProgramCardFrame } from './ProgramCardFrame'
import { ProgramTemplateRow } from './ProgramTemplateRow'

const CALENDAR_ICON_SIZE = 20

interface ProgramProposalCardProps {
	card: ProgramCard
	controls: ProgramCardControls
	/** The card comes from the five answers of the training onboarding. */
	isFromOnboarding?: boolean
}

/** «Програма: 2 тренування» (mockups/chat-program.html): the first version of a program, not saved before «Прийняти». */
export const ProgramProposalCard = ({
	card,
	controls,
	isFromOnboarding = false,
}: ProgramProposalCardProps) => {
	const { t } = useTranslation()
	const { program } = card
	const subtitle = [
		t(`program.mode.${program.mode}`),
		program.perWeek === null ? null : t('program.perWeek', { count: program.perWeek }),
	]
		.filter((part): part is string => part !== null)
		.join(DETAIL_SEPARATOR)

	return (
		<ProgramCardFrame
			controls={controls}
			note={t(isFromOnboarding ? 'program.card.noteOnboarding' : 'program.card.note')}
		>
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className="flex size-9 flex-none items-center justify-center rounded-icon bg-hint-training-bg text-hint-training-ink"
				>
					<Icon name="calendar" size={CALENDAR_ICON_SIZE} />
				</span>
				<div className="flex min-w-0 flex-col">
					<Text as="p" role="heading" aria-level={3} variant="body" weight="extrabold">
						{t('program.card.title', { count: program.templates.length })}
					</Text>
					<Text variant="small" tone="muted" weight="regular">
						{subtitle}
					</Text>
				</div>
			</div>
			<ul className="flex flex-col">
				{program.templates.map((template) => (
					<ProgramTemplateRow key={template.key} template={template} />
				))}
			</ul>
		</ProgramCardFrame>
	)
}
