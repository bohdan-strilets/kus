import { estimateTemplateMinutes } from '@kus/shared'

import { toSaveExercises } from './template-draft'
import type { DraftExercise } from './template-draft.types'

/** The «~55 хв» of the template as the edits leave it; none for an empty one. */
export const getEditedEstimateMin = (exercises: readonly DraftExercise[]): number =>
	exercises.length === 0 ? 0 : estimateTemplateMinutes(toSaveExercises(exercises))
