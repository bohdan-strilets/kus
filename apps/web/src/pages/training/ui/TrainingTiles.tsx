import type { ProgramResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatProgramVersionDate } from '@/entities/program'
import { TRAINING_PROGRAM_ROUTE } from '@/shared/config'

import { useStartTrainingSetup } from '../model/use-start-training-setup'
import { TrainingStatsTile } from './TrainingStatsTile'
import { TrainingTile } from './TrainingTile'

interface TrainingTilesProps {
	today: string
	/** Nothing to count in an empty journal. */
	isStatsShown: boolean
	/** The active program; null = none; undefined = unknown (still loading or failed), no tile. */
	program: ProgramResponse | null | undefined
}

/** The row under the templates: «Статистика» and «Програма · Версія від …» (or «Налаштувати» without a program). */
export const TrainingTiles = ({ today, isStatsShown, program }: TrainingTilesProps) => {
	const { t } = useTranslation()
	const { startSetup } = useStartTrainingSetup()

	return (
		<div className="flex gap-2">
			{isStatsShown && <TrainingStatsTile today={today} isShort={program !== undefined} />}
			{program && (
				<TrainingTile
					icon="calendar"
					title={t('training.programTile.title')}
					subtitle={formatProgramVersionDate(program.version.createdAt, t)}
					to={TRAINING_PROGRAM_ROUTE}
				/>
			)}
			{program === null && (
				<TrainingTile
					icon="calendar"
					title={t('training.programTile.title')}
					subtitle={t('training.programTile.setup')}
					onClick={startSetup}
				/>
			)}
		</div>
	)
}
