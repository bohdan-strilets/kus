import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'

import { useLocalToday } from '@/entities/day'
import { useActiveProgram } from '@/entities/program'
import { useSessionUser } from '@/entities/session'
import { ROUTES, TRAINING_FILL_TEMPLATE_PARAM } from '@/shared/config'
import { getLocalTime, useDelayedFlag } from '@/shared/lib'
import { InlineError, Loader } from '@/shared/ui'

import { FillScreen } from './FillScreen'

const LOADER_SIZE = 96

/**
 * `/app/training/fill?templateId=…`: the form of a template of the active program; without the
 * parameter an empty session. A template that is not in the program (removed meanwhile) leads
 * back to the tab.
 */
export const TrainingFillPage = () => {
	const user = useSessionUser()
	// the session guard renders /app only with a user; this keeps the types honest
	if (!user) return null
	return <TrainingFillLoader timeZone={user.timezone} />
}

const TrainingFillLoader = ({ timeZone }: { timeZone: string }) => {
	const { t } = useTranslation()
	const [params] = useSearchParams()
	const templateId = params.get(TRAINING_FILL_TEMPLATE_PARAM)
	const programQuery = useActiveProgram()
	const localDate = useLocalToday(timeZone)
	// the moment the form opened: «Сьогодні · 18:30» does not creep while the person fills it in
	const [time] = useState(() => getLocalTime(new Date(), timeZone))
	const isLoaderShown = useDelayedFlag(programQuery.isPending && templateId !== null)

	if (templateId === null) return <FillScreen template={null} now={{ localDate, time }} />
	if (programQuery.isError) {
		return (
			<div className="px-gutter pt-8">
				<InlineError
					message={t('training.form.loadError')}
					onRetry={() => void programQuery.refetch()}
				/>
			</div>
		)
	}
	if (programQuery.isPending) {
		return (
			<div className="flex flex-1 items-center justify-center">
				{isLoaderShown && <Loader size={LOADER_SIZE} ariaLabel={t('common.loading')} />}
			</div>
		)
	}
	const template = programQuery.data?.templates.find((item) => item.id === templateId) ?? null
	if (template === null) return <Navigate to={ROUTES.training} replace />
	return <FillScreen template={template} now={{ localDate, time }} />
}
