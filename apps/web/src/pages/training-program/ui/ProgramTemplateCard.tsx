import type { ProgramMode, ProgramTemplateResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatProgramTemplateMeta, getTemplateGroups } from '@/entities/program'
import { GroupTag } from '@/entities/workout'
import { getTrainingTemplatePath } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Badge, Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

import { WeekdayPicker } from './WeekdayPicker'

interface ProgramTemplateCardProps {
	template: ProgramTemplateResponse
	mode: ProgramMode
	isNext: boolean
	isPinned: boolean
	/** A change is on its way: the controls wait for it. */
	isBusy: boolean
	onPin: () => void
	onToggleWeekday: (isoWeekday: number) => void
}

/**
 * A day of the program: the whole card opens it (a stretched link), the controls of the mode sit
 * above the link: «Обрати» in «Завжди одне», the weekdays in «За днями тижня».
 */
export const ProgramTemplateCard = ({
	template,
	mode,
	isNext,
	isPinned,
	isBusy,
	onPin,
	onToggleWeekday,
}: ProgramTemplateCardProps) => {
	const { t } = useTranslation()
	const groups = getTemplateGroups(template.exercises)

	return (
		<Surface as="article" variant="list" className="relative flex flex-col gap-2 p-3.5">
			<div className="flex items-center gap-2">
				{mode === 'SINGLE' && (
					<button
						type="button"
						aria-pressed={isPinned}
						aria-label={t('program.screen.pin', { name: template.name })}
						disabled={isBusy}
						onClick={onPin}
						// the ring is 24px; the 44px tap area is the button itself
						className="relative z-10 -my-2.5 -ml-2.5 flex size-11 flex-none cursor-pointer items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-default"
					>
						<span
							className={cn(
								'flex size-6 items-center justify-center rounded-full border-2',
								isPinned
									? 'border-hint-training-ink bg-hint-training-ink text-white'
									: 'border-line-strong text-transparent',
							)}
						>
							<Icon name="check" size={ICON_SIZE.small} />
						</span>
					</button>
				)}
				<Link
					to={getTrainingTemplatePath(template.id)}
					className="flex min-w-0 flex-1 items-center gap-2 text-ink outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink"
				>
					<Text as="span" variant="body" weight="extrabold" className="min-w-0 flex-1 truncate">
						{template.name}
					</Text>
					{isNext && <Badge variant="training">{t('program.screen.next')}</Badge>}
					<Icon name="chevron-right" size={ICON_SIZE.control} className="flex-none text-muted" />
				</Link>
			</div>
			<Text as="p" variant="caption" tone="mutedStrong" weight="regular">
				{formatProgramTemplateMeta(template, t)}
			</Text>
			{groups.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{groups.map((group) => (
						<GroupTag key={group} group={group} size="sm" />
					))}
				</div>
			)}
			{mode === 'WEEKDAYS' && (
				<WeekdayPicker
					templateName={template.name}
					weekdays={template.weekdays}
					isDisabled={isBusy}
					onToggle={onToggleWeekday}
				/>
			)}
		</Surface>
	)
}
