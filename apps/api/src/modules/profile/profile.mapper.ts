import {
	type AuthUser,
	type CalculateGoalsInput,
	getAgeFromBirthYear,
	getBirthYearFromAge,
	type ProfileGoals,
	type ProfileResponse,
	type UpdateProfileRequest,
} from '@kus/shared'

import { formatDbDate, getLocalDate, getLocalDateString } from '../../common/time'
import { GoalType, type UserProfile, type WeightEntry } from '../../generated/prisma/client'
import { WEIGHT_DECIMALS } from './profile.constants'
import { ProfileIncompleteException } from './profile.exceptions'
import type { ProfileFields } from './profile.repository'

/** The user's "now": the moment, their calendar day and year; the age and the goal day depend on them. */
export interface Clock {
	now: Date
	today: Date
	year: number
}

export const getClock = (timezone: string): Clock => {
	const now = new Date()
	return {
		now,
		today: getLocalDate(now, timezone),
		year: Number(getLocalDateString(now, timezone).slice(0, 4)),
	}
}

export const roundWeight = (kg: number): number => Number(kg.toFixed(WEIGHT_DECIMALS))

export const toProfileFields = (body: UpdateProfileRequest, year: number): ProfileFields => {
	const fields: ProfileFields = {}
	if (body.sex !== undefined) fields.sex = body.sex
	if (body.age !== undefined) fields.birthYear = getBirthYearFromAge(body.age, year)
	if (body.heightCm !== undefined) fields.heightCm = body.heightCm
	if (body.activityLevel !== undefined) fields.activityLevel = body.activityLevel
	if (body.targetWeightKg !== undefined) {
		fields.targetWeightKg = body.targetWeightKg === null ? null : roundWeight(body.targetWeightKg)
	}
	if (body.goalType !== undefined) fields.goalType = body.goalType
	if (body.paceKgPerWeek !== undefined) fields.paceKgPerWeek = body.paceKgPerWeek
	return fields
}

export const toProfileResponse = ({
	user,
	profile,
	weight,
	goals,
	year,
}: {
	user: AuthUser
	profile: UserProfile | null
	weight: WeightEntry | null
	goals: ProfileGoals | null
	year: number
}): ProfileResponse => ({
	email: user.email,
	name: user.name,
	addressAs: user.addressAs,
	profile: {
		sex: profile?.sex ?? null,
		age: profile?.birthYear == null ? null : getAgeFromBirthYear(profile.birthYear, year),
		heightCm: profile?.heightCm ?? null,
		activityLevel: profile?.activityLevel ?? null,
		targetWeightKg: profile?.targetWeightKg ?? null,
		goalType: profile?.goalType ?? null,
		paceKgPerWeek: profile?.paceKgPerWeek ?? null,
	},
	weight: weight ? { kg: weight.weightKg, localDate: formatDbDate(weight.localDate) } : null,
	goals,
})

/** The fields of «Мої дані» the calculation still lacks; names as the client sends them. */
const getMissingFields = (profile: UserProfile | null, weight: WeightEntry | null): string[] => {
	const missing: string[] = []
	if (!profile?.sex) missing.push('sex')
	if (profile?.birthYear == null) missing.push('age')
	if (profile?.heightCm == null) missing.push('heightCm')
	if (!profile?.activityLevel) missing.push('activityLevel')
	if (!profile?.goalType) missing.push('goalType')
	if (!weight) missing.push('weightKg')
	const isPaceNeeded = profile?.goalType != null && profile.goalType !== GoalType.MAINTAIN
	if (isPaceNeeded && profile.paceKgPerWeek == null) missing.push('paceKgPerWeek')
	return missing
}

/** Builds the calculation input, or names the fields «Мої дані» still lacks. */
export const toCalculationInput = ({
	profile,
	weight,
	year,
}: {
	profile: UserProfile | null
	weight: WeightEntry | null
	year: number
}): CalculateGoalsInput => {
	const missing = getMissingFields(profile, weight)
	// the field checks narrow the types; the list makes the error useful
	if (
		missing.length > 0 ||
		!profile?.sex ||
		profile.birthYear == null ||
		profile.heightCm == null ||
		!profile.activityLevel ||
		!profile.goalType ||
		!weight
	) {
		throw new ProfileIncompleteException(missing)
	}

	return {
		sex: profile.sex,
		age: getAgeFromBirthYear(profile.birthYear, year),
		heightCm: profile.heightCm,
		weightKg: weight.weightKg,
		targetWeightKg: profile.targetWeightKg,
		activityLevel: profile.activityLevel,
		goalType: profile.goalType,
		paceKgPerWeek: profile.paceKgPerWeek,
	}
}
