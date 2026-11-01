import type { ExerciseStatsResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { StatTile } from '@/entities/workout'

import { getRecordTiles } from '../lib/exercise-view'
import { HistoryCard } from './HistoryCard'
import { ProgressCard } from './ProgressCard'

interface ExerciseContentProps {
	data: ExerciseStatsResponse
}

/** The loaded exercise: the progress of the period, the all-time bests, the history. */
export const ExerciseContent = ({ data }: ExerciseContentProps) => {
	const { t } = useTranslation()
	const tiles = getRecordTiles(data.best, data.exercise.isBodyweight, t)

	return (
		<>
			<ProgressCard data={data} />
			{tiles.length > 0 && (
				<div className="flex gap-2">
					{tiles.map((tile) => (
						<StatTile
							key={tile.key}
							label={tile.label}
							value={tile.value}
							note={tile.date}
							isRecord={tile.isRecord}
						/>
					))}
				</div>
			)}
			<HistoryCard history={data.history} kind={data.exercise.kind} />
		</>
	)
}
