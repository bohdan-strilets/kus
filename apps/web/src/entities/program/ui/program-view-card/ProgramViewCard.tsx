import type { ProgramView } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { TRAINING_PROGRAM_ROUTE } from '@/shared/config'
import { formatShortDate } from '@/shared/lib'
import { Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

import { formatProgramViewSubtitle } from '../../lib/format-program-screen'
import { getShownTemplates } from '../../lib/get-shown-templates'
import { ProgramTemplateRow } from '../ProgramTemplateRow'

const CALENDAR_ICON_SIZE = 20

interface ProgramViewCardProps {
	view: ProgramView
}

/** The program in force, on request («яка в мене програма»): a read-only look with the way to its screen. */
export const ProgramViewCard = ({ view }: ProgramViewCardProps) => {
	const { t } = useTranslation()
	const { program } = view
	const { templates, otherCount } = getShownTemplates(program)

	return (
		<Surface className="flex flex-col gap-2.5 p-3.5">
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className="flex size-9 flex-none items-center justify-center rounded-icon bg-hint-training-bg text-hint-training-ink"
				>
					<Icon name="calendar" size={CALENDAR_ICON_SIZE} />
				</span>
				<div className="flex min-w-0 flex-col">
					<Text as="p" role="heading" aria-level={3} variant="body" weight="extrabold">
						{t('program.view.title', { count: templates.length })}
					</Text>
					<Text variant="small" tone="muted" weight="regular">
						{formatProgramViewSubtitle(view, t)}
					</Text>
				</div>
			</div>
			<ul className="flex flex-col">
				{templates.map((template) => (
					<ProgramTemplateRow key={template.key} template={template} />
				))}
			</ul>
			{otherCount > 0 && (
				<Text variant="small" tone="muted" weight="regular">
					{t('program.view.otherTemplates', { count: otherCount })}
				</Text>
			)}
			<Text variant="small" tone="muted" weight="regular">
				{t('program.view.version', {
					date: formatShortDate(new Date(view.versionCreatedAt)),
				})}
			</Text>
			<Link
				to={TRAINING_PROGRAM_ROUTE}
				className="inline-flex min-h-tap items-center gap-1 self-start text-card-title font-bold text-primary-deep underline underline-offset-2"
			>
				{t('program.view.open')}
				<Icon name="chevron-right" size={ICON_SIZE.small} />
			</Link>
		</Surface>
	)
}
