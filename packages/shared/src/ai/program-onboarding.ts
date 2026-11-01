// The answers of the training onboarding as the model reads them in «Program» (c6 §3, approved):
// «place GYM; usually STRENGTH_AND_CARDIO; level EXPERIENCED; 3 per week; equipment FULL_GYM, PULL_UP_BAR».
import type {
	TrainingActivity,
	TrainingEquipment,
	TrainingLevel,
	TrainingPerWeek,
	TrainingPlace,
} from '../schemas/training-onboarding.js'

export interface TrainingOnboardingAnswers {
	place: TrainingPlace
	activity: TrainingActivity
	level: TrainingLevel
	perWeek: TrainingPerWeek
	equipment: readonly TrainingEquipment[]
}

export const formatOnboardingAnswers = ({
	place,
	activity,
	level,
	perWeek,
	equipment,
}: TrainingOnboardingAnswers): string =>
	`place ${place}; usually ${activity}; level ${level}; ${perWeek} per week; equipment ${equipment.join(', ')}`
