import type { ExpectedValue } from './case.types.js'

const DECIMALS = 10

/** Value for a weighed portion from per-100 g reference data. */
export const per100 = (valuePer100g: number, grams: number): ExpectedValue => ({
	exact: Math.round(((valuePer100g * grams) / 100) * DECIMALS) / DECIMALS,
})

export const exact = (value: number): ExpectedValue => ({ exact: value })

export const range = (min: number, max: number): ExpectedValue => ({ min, max })
