import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'

import { formatProgramSubtitle, useActiveProgram } from '@/entities/program'
import { TAB_ROUTES } from '@/shared/config'
import { InlineError, ScreenHeader } from '@/shared/ui'

import { ProgramScreen } from './ProgramScreen'
import { ProgramSkeleton } from './ProgramSkeleton'

/**
 * mockups/training-program.html: the program in force, how its days alternate, the history of its
 * versions. Without a program there is nothing to show: the training tab offers to make one.
 */
export const TrainingProgramPage = () => {
	const { t } = useTranslation()
	const query = useActiveProgram()
	const program = query.data

	if (program === null) return <Navigate to={TAB_ROUTES.training} replace />

	return (
		<div className="flex flex-1 flex-col">
			<ScreenHeader
				title={t('pages.trainingProgram.title')}
				subtitle={program ? formatProgramSubtitle(program, t) : undefined}
				backTo={TAB_ROUTES.training}
			/>
			<div className="flex flex-col gap-2 px-gutter pt-1 pb-4">
				{program && <ProgramScreen program={program} />}
				{!program && query.isError && (
					<InlineError
						message={t('program.screen.loadError')}
						onRetry={() => void query.refetch()}
					/>
				)}
				{query.isPending && <ProgramSkeleton />}
			</div>
		</div>
	)
}
