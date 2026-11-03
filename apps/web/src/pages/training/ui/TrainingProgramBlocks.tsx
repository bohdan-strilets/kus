import type { ProgramResponse } from '@kus/shared'

import { useLiveWorkout } from '@/entities/workout'

import { getNextTemplate } from '../lib/get-program-view'
import { NextWorkoutCard } from './NextWorkoutCard'
import { OpenWorkoutCard } from './OpenWorkoutCard'
import { TemplateRows } from './TemplateRows'

/** The top of the tab with a program: «Наступне» and «Мої шаблони». */
export const TrainingProgramBlocks = ({ program }: { program: ProgramResponse }) => {
	const next = getNextTemplate(program)
	const live = useLiveWorkout().data

	return (
		<>
			{live ? <OpenWorkoutCard live={live} /> : next && <NextWorkoutCard template={next} />}
			{program.templates.length > 0 && <TemplateRows templates={program.templates} />}
		</>
	)
}
