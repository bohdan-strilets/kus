import type { ProgramTemplateResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { formatProgramTemplateMeta, getTemplateGroups } from '@/entities/program'
import { GroupDot } from '@/entities/workout'
import { getTrainingTemplatePath, TRAINING_PROGRAM_ROUTE } from '@/shared/config'
import { Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

/** «Мої шаблони» of mockups/training-home.html (0.10.2): any template, not only the next one, and the way to the program. */
export const TemplateRows = ({ templates }: { templates: ProgramTemplateResponse[] }) => {
	const { t } = useTranslation()

	return (
		<section className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between px-1 pt-1.5">
				<Text as="span" variant="eyebrow" tone="muted">
					{t('training.templates.title')}
				</Text>
				<Link
					to={TRAINING_PROGRAM_ROUTE}
					className="-my-3 inline-flex min-h-tap items-center gap-0.5 text-small font-semibold text-muted-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
				>
					{t('training.templates.programLink')}
					<Icon name="chevron-right" size={ICON_SIZE.small} />
				</Link>
			</div>
			<Surface variant="list" radius="panel" className="px-3.5 py-0.5">
				<ul className="flex flex-col divide-y divide-divider">
					{templates.map((template) => {
						const groups = getTemplateGroups(template.exercises)
						const meta = formatProgramTemplateMeta(template, t)
						return (
							<li key={template.id}>
								<Link
									to={getTrainingTemplatePath(template.id)}
									aria-label={[
										template.name,
										meta,
										groups.map((group) => t(`muscle.${group}`)).join(', '),
									]
										.filter((part) => part !== '')
										.join('. ')}
									className="flex min-h-14 items-center gap-2.5 py-1.5 text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
								>
									<span aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
										<Text as="span" variant="body" weight="bold" className="truncate">
											{template.name}
										</Text>
										<Text as="span" variant="small" tone="muted" className="truncate">
											{meta}
										</Text>
									</span>
									<span aria-hidden="true" className="flex flex-none gap-0.75">
										{groups.map((group) => (
											<GroupDot key={group} group={group} size="sm" />
										))}
									</span>
									<Icon
										name="chevron-right"
										size={ICON_SIZE.control}
										className="flex-none text-muted-strong"
									/>
								</Link>
							</li>
						)
					})}
				</ul>
			</Surface>
		</section>
	)
}
