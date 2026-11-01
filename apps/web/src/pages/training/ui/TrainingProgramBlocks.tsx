import type { ProgramResponse } from '@kus/shared'

import { getNextTemplate } from '../lib/get-program-view'
import { NextWorkoutCard } from './NextWorkoutCard'
import { TemplateRows } from './TemplateRows'

/** The top of the tab with a program: «Наступне» and «Мої шаблони». */
export const TrainingProgramBlocks = ({ program }: { program: ProgramResponse }) => {
	const next = getNextTemplate(program)

	return (
		<>
			{next && <NextWorkoutCard template={next} />}
			{program.templates.length > 0 && <TemplateRows templates={program.templates} />}
		</>
	)
}
