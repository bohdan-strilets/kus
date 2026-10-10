import { formatDecimal } from '@/shared/lib'

const HALF_KG = 0.5

/** «0,25» / «0,5»: the pace without a sign, for texts that put the sign in themselves. */
export const formatPaceValue = (pace: number): string =>
	formatDecimal(pace, pace % HALF_KG === 0 ? 1 : 2)
