import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'

import { useActiveProgram } from '@/entities/program'
import { TAB_ROUTES, TRAINING_PROGRAM_ROUTE } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { TemplateScreen } from './TemplateScreen'
import { TemplateSkeleton } from './TemplateSkeleton'

/**
 * mockups/training-program.html «Шаблон» / «Редактор»: one day of the program. A day that is not in
 * the active version (an old link, a program changed elsewhere) leads back to the program.
 */
export const TrainingTemplatePage = () => {
	const { t } = useTranslation()
	const { id = '' } = useParams()
	const query = useActiveProgram()
	const program = query.data
	// a saved version gives the day a new id: the key tells it is still the same day
	const [templateKey, setTemplateKey] = useState<string | null>(null)
	const template =
		program?.templates.find((item) => item.id === id) ??
		program?.templates.find((item) => item.key === templateKey)
	if (template && template.key !== templateKey) setTemplateKey(template.key)

	if (program === null) return <Navigate to={TAB_ROUTES.training} replace />
	if (program && !template) return <Navigate to={TRAINING_PROGRAM_ROUTE} replace />
	if (program && template) return <TemplateScreen program={program} template={template} />

	return (
		<div className="flex flex-1 flex-col">
			<ScreenHeader title={t('pages.trainingTemplate.title')} backTo={TRAINING_PROGRAM_ROUTE} />
			<div className="px-gutter pt-1">
				{query.isError ? (
					<InlineError
						message={t('program.template.loadError')}
						onRetry={() => void query.refetch()}
					/>
				) : (
					<TemplateSkeleton />
				)}
			</div>
		</div>
	)
}
